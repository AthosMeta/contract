// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/WETH.sol";

contract Stake is Ownable {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    struct Rate {
        uint256 APR;
        uint256 period;
        uint256 withdrawFee;
        uint256 tm;
    }

    struct Staking {
        uint256 id;
        address owner;
        address token;
        uint256 amount;
        uint256 withdrawedAmount;
        bool isWrapped;
        bool completed;
        uint256 APR;
        uint256 period;
        uint256 createdAt; //timestamp,
        uint256 updatedAt;
    }

    uint256 private _denominator = 10000;
    uint256 private _period = 86400; // each day
    uint256 private _totalPeriods = 365; // 1 year
    uint256 private _feeEarlyWithdraw = 1000; // 10% fee for early withdraw
    address private _WETH;

    mapping(bytes32 => Rate) private _rates; //mapping token -> rate
    Staking[] private _staking; //mapping id -> staking
    mapping(address => EnumerableSet.UintSet) private _userStakingIds; //mapping user -> staking ids

    event StakingCreated(uint256 indexed id, address indexed owner, address token, uint256 amount, bool isWrapped, uint256 APR, uint256 period);
    event StakingCompleted(uint256 indexed id, address indexed owner, address token, uint256 amount, bool isWrapped, uint256 APR,  uint256 period, bool isEearly);
    event WithdrawProfit(uint256 indexed id, address indexed owner, address token, uint256 profit);
    constructor(address WETH, uint256 denominator, uint256 period, uint256 totalPeriods, uint256 feeEarlyWithdraw) Ownable() {
        _WETH = WETH;
        _denominator = denominator;
        _period = period;
        _totalPeriods = totalPeriods;
        _feeEarlyWithdraw = feeEarlyWithdraw;
    }
    modifier isTokenStakeable(address token, uint256 period) {
        require(_rates[_getKeyRate(token, period)].tm > 0, "TOKEN_NOT_VAILD");
        _;
    }
    function createStakeToken(address token, uint256 amount, uint256 period) external isTokenStakeable(token, period) {
        require(amount > 0, "AMOUNT_NOT_VAILD");
        //check token allowance
        require(IERC20(token).allowance(msg.sender, address(this)) >= amount, "TOKEN_ALLOWANCE_NOT_ENOUGH");
        //transferFrom token to contract
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        //create staking
        _createStake(token, amount, period, false);
    }
    function createStakeEth( uint256 period) external payable {
        require(msg.value > 0, "AMOUNT_NOT_VAILD");
        require(_rates[_getKeyRate(_WETH, period)].tm > 0, "TOKEN_NOT_VAILD");
        //deposit eth
        IWETH(_WETH).deposit{value:msg.value}();
        //create staking
        _createStake(_WETH, msg.value, period, true);
    }

    function _createStake(address token, uint256 amount, uint256 period, bool isWrapped) internal {
        (uint256 APR,) = getRate(token, period);
        uint256 id = _staking.length;
        Staking memory staking = Staking(id, msg.sender, token, amount, 0, isWrapped, false, APR, period, block.timestamp, block.timestamp);
        _staking.push(staking);
        _userStakingIds[msg.sender].add(id);
        emit StakingCreated(id, msg.sender, token, amount, isWrapped, APR, period);
    }

    function unstake(uint256 id) external {
        Staking memory staking = _staking[id];
        require(staking.owner == msg.sender, "NOT_OWNER");
        require(block.timestamp > staking.createdAt + (staking.period * _period), "NOT_TIME_TO_UNSTAKE");
        require(!staking.completed, "ALREADY_COMPLETED");
        
        uint256 profit = _caculateProfit(staking.amount, staking.APR, staking.period);
        profit -= staking.withdrawedAmount;
        Rate memory rate = _rates[_getKeyRate(staking.token, staking.period)];
        uint256 profitAfterFee = profit - (profit * rate.withdrawFee / _denominator);
        uint256 amountAfterFee = staking.amount - (staking.amount * rate.withdrawFee / _denominator);
        uint256 totalAmount = amountAfterFee + profitAfterFee;
        if (staking.isWrapped) {
            IWETH(staking.token).withdraw(totalAmount);
            payable(msg.sender).transfer(totalAmount);
        } else {
            IERC20(staking.token).transfer(msg.sender, totalAmount);
        }
        //remove staking
        _staking[id].completed = true;
        _staking[id].withdrawedAmount += profit;
        _staking[id].updatedAt = block.timestamp;
        //_userStakingIds[msg.sender].remove(id);
        emit StakingCompleted(id, msg.sender, staking.token, amountAfterFee, staking.isWrapped, staking.APR, staking.period, false);
        if(profit > 0) emit WithdrawProfit(id, msg.sender, staking.token, profitAfterFee);
        
    }
    function earlyUnstake(uint256 id) external {
        Staking memory staking = _staking[id];
        require(staking.owner == msg.sender, "NOT_OWNER");
        require(block.timestamp < staking.createdAt + (staking.period * _period), "NOT_EARLY_UNSTAKE");
        require(!staking.completed, "ALREADY_COMPLETED");
        uint256 period = block.timestamp.sub(staking.createdAt).div(_period);
        uint256 profit = _caculateProfit(staking.amount, staking.APR, period);
        profit -= staking.withdrawedAmount;
        uint256 profitAfterFee = profit - (profit * _feeEarlyWithdraw / _denominator);
        uint256 amountAfterFee = staking.amount - (staking.amount * _feeEarlyWithdraw / _denominator);
        uint256 totalAmount = amountAfterFee + profitAfterFee;
        if (staking.isWrapped) {
            IWETH(staking.token).withdraw(totalAmount);
            payable(msg.sender).transfer(totalAmount);
        } else {
            IERC20(staking.token).transfer(msg.sender, totalAmount);
        }
        //remove staking
        _staking[id].completed = true;
        _staking[id].withdrawedAmount += profit;
        _staking[id].updatedAt = block.timestamp;
        //_userStakingIds[msg.sender].remove(id);
        emit StakingCompleted(id, msg.sender, staking.token, amountAfterFee, staking.isWrapped, staking.APR, staking.period, true);
        if(profit > 0) emit WithdrawProfit(id, msg.sender, staking.token, profitAfterFee);
    }
    function withdrawProfit(uint256 id) external {
        Staking memory staking = _staking[id];
        require(staking.owner == msg.sender, "NOT_OWNER");
        require(!staking.completed, "COMPLETED");
        uint256 period = block.timestamp.sub(staking.createdAt).div(_period);
        period = period < staking.period ? period : staking.period;
        uint256 profit = _caculateProfit(staking.amount, staking.APR, period);
        require(profit > staking.withdrawedAmount, "NO_PROFIT");
        profit -= staking.withdrawedAmount;
        Rate memory rate = _rates[_getKeyRate(staking.token, staking.period)];
        uint256 fee = profit.mul(rate.withdrawFee).div(_denominator);
        uint256 profitAfterFee = profit.sub(fee);
        if (staking.isWrapped) {
            IWETH(staking.token).withdraw(profitAfterFee);
            payable(msg.sender).transfer(profitAfterFee);
        } else {
            IERC20(staking.token).transfer(msg.sender, profitAfterFee);
        }
        _staking[id].withdrawedAmount += profit;
        _staking[id].updatedAt = block.timestamp;
        emit WithdrawProfit(id, msg.sender, staking.token, profitAfterFee);
    }
    function caculateProfitOfId(uint256 id) external view returns (uint256 completeProfit, uint256 estimateProfit) {
        Staking memory staking = _staking[id];
        require(!staking.completed, "ALREADY_COMPLETED");
        uint256 _completeProfit = _caculateProfit(staking.amount, staking.APR, staking.period);
        uint256 currentDays = (block.timestamp - staking.createdAt) / _period;
        uint256 _estimateProfit = _caculateProfit(staking.amount, staking.APR, currentDays);
        _estimateProfit -= staking.withdrawedAmount;
        return (_completeProfit, _estimateProfit);
    }
    function _caculateProfit(uint256 amount, uint256 APR, uint256 period) internal view returns (uint256) {
        uint256 profit = amount.mul(APR).mul(period).div(_denominator).div(_totalPeriods);
        return profit;
    }
    function setRate(address token, uint256 APR, uint256 period, uint256 withdrawFee) external onlyOwner {
        require(APR > 0, "APR_NOT_VAILD");
        bytes32 key = keccak256(abi.encodePacked(token, period));
        _rates[key] = Rate(APR, period, withdrawFee, block.timestamp);
    }
    function removeRate(address token, uint256 period) external onlyOwner isTokenStakeable(token, period) {
        bytes32 key = _getKeyRate(token, period);
        _rates[key] = Rate(0, 0, 0, 0);
    }
    function getRate(address token, uint256 period) public view returns (uint256 APR, uint256 withdrawFee) {
        bytes32 key = _getKeyRate(token, period);
        return (_rates[key].APR, _rates[key].withdrawFee);
    }
    function _getKeyRate(address token, uint256 period) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(token, period));
    }
    function getStakingOfId(uint256 id) external view returns (Staking memory) {
        return _staking[id];
    }
    function getStakingOfUser(address user) public view returns (Staking[] memory) {
        uint256[] memory ids = _userStakingIds[user].values();
        Staking[] memory stakings = new Staking[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            stakings[i] = _staking[ids[i]];
        }
        return stakings;
    }
    receive() external payable {}

    fallback() external payable {}

    function withdraw(address token, uint256 amount) external onlyOwner {
        if(token == _WETH) {
            IWETH(_WETH).withdraw(amount);
            payable(msg.sender).transfer(amount);
        } else {
            ERC20(token).transfer(msg.sender, amount);
        }
    }
    function depositEth() external payable {
        IWETH(_WETH).deposit{value:msg.value}();
    }
    function getDenominator() external view returns (uint256) {
        return _denominator;
    }
}
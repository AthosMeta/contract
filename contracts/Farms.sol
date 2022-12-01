// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "./interfaces/WETH.sol";
import "hardhat/console.sol";

contract Farms is Ownable {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    struct Rate {
        uint256 totalRate;
        uint256 timestamp;
        uint256 APR;
    }
    
    struct Farm {
        uint256 id;
        uint256 startedRate;
        uint256 mainTokenAmount; // 
        uint256 pairTokenAmount; //
        address pairToken;
        uint256 withdrawnProfit;//
        bool isWrapped;// token1 is wrapped or not
        address owner;
        bool completed;
        uint256 createdAt; //timestamp
        uint256 lastWithdrawnProfit; //timestamp
        uint256 endAt; //timestamp
    }
    //uint256 private _refsRate = 3000; // 30% for referers
    uint256 private _denominator = 10000;
    uint256 private _period = 86400; // each day
    uint256 private _totalPeriods = 365; // 1 year
    address private _mainToken; // USDT on testnet
    address private _WETH;
    address private _pancakeRouterV2;
    mapping(address => Rate) private _rates;
    Farm[] private _farms;
    mapping(address => EnumerableSet.UintSet) private _userFarmIds;

    event FarmCreated(uint256 indexed id, uint256 startedRate, uint256 mainTokenAmount, uint256 pairTokenAmount, address pairToken, address owner, bool isWrapped);
    event FarmHarvested(uint256 indexed id, uint256 mainTokenAmount, uint256 pairTokenAmount, address pairToken, address owner, bool isWrapped, uint256 profit, uint256 profitPercent, uint256 pairTokenAmountConverted );
    event FarmRemoved(uint256 indexed id, uint256 mainTokenAmount, uint256 pairTokenAmount, address pairToken, address owner, bool isWrapped);

    constructor (address mainToken, address WETH, address pancakeRouterV2, uint256 denominator, uint256 period, uint256 totalPeriods) Ownable() {
        _mainToken = mainToken;
        _WETH = WETH;
        _pancakeRouterV2 = pancakeRouterV2;
        _denominator = denominator;
        _period = period;
        _totalPeriods = totalPeriods;
    }
    modifier isTokenFarmable(address _token) {
        //check _token in _rates
        require(_rates[_token].timestamp > 0, "Token is not farmable");
        _;
    }
    function createFarmWithToken(uint256 mainTokenAmount, uint256 pairTokenAmount, address pairToken) public isTokenFarmable(pairToken)  {
        require(mainTokenAmount > 0, "TOKEN0_NOT_VAILD");
        require(pairTokenAmount > 0, "TOKEN1_NOT_VAILD");
        require(pairToken != _mainToken, "DUPLICATE_TOKEN");
        uint256 exactMainTokenAmount = _getAmountOut(pairTokenAmount, pairToken, _mainToken);
        require(exactMainTokenAmount <= mainTokenAmount , "RATE_ERROR");
        //check allowance
        require(ERC20(_mainToken).allowance(msg.sender, address(this)) >= exactMainTokenAmount, "ALLOWANCE0");
        require(ERC20(pairToken).allowance(msg.sender, address(this)) >= pairTokenAmount, "ALLOWANCE1");
        //transferFrom
        ERC20(_mainToken).transferFrom(msg.sender, address(this), exactMainTokenAmount);
        ERC20(pairToken).transferFrom(msg.sender, address(this), pairTokenAmount);
        //create farm
        _createFarm(exactMainTokenAmount, pairTokenAmount, pairToken, msg.sender, false);
    }
    function createFarmWithEth(uint256 mainTokenAmount) public payable{
        require(mainTokenAmount > 0, "TOKEN0_NOT_VAILD");
        uint256 pairTokenAmount = msg.value;
        require(pairTokenAmount > 0, "TOKEN1_NOT_VAILD");
        uint256 exactMainTokenAmount = _getAmountOut(pairTokenAmount, _WETH, _mainToken);
        require(exactMainTokenAmount  <= mainTokenAmount , "RATE_ERROR");
         //check allowance
        require(ERC20(_mainToken).allowance(msg.sender, address(this)) >= exactMainTokenAmount, "ALLOWANCE0");
        ERC20(_mainToken).transferFrom(msg.sender, address(this), exactMainTokenAmount);
        //swap ETH to WETH
        IWETH(_WETH).deposit{value:pairTokenAmount}();
        //create farm
        _createFarm(exactMainTokenAmount, pairTokenAmount, _WETH, msg.sender, true);
    }
    function _createFarm( uint256 mainTokenAmount, uint256 pairTokenAmount, address pairToken, address owner, bool isWrapped) internal returns (uint256) {
        uint256 id = _farms.length;
        uint256 startedRate = getCurrentRate(pairToken);
        _farms.push(Farm(id, startedRate, mainTokenAmount, pairTokenAmount, pairToken, 0, isWrapped, owner, false, block.timestamp, 0, 0));
        _userFarmIds[_msgSender()].add(id);
        emit FarmCreated(id, startedRate, mainTokenAmount, pairTokenAmount, pairToken, owner, isWrapped);
        return id;
    }
    function harvest(uint256 id) external {
        Farm storage farm = _farms[id];
        require(farm.owner == msg.sender, "FARM_NOT_OWNER");
        require(!farm.completed, "FARM_COMPLETED");
        (uint256 profit, uint256 pairTokenAmountConverted, uint256 percent) = _getProfit(id);
        
        //transfer mainToken to msg.sender
        ERC20(_mainToken).transfer(msg.sender, profit);
        //update farm withdraw profit
        farm.withdrawnProfit = farm.withdrawnProfit.add(profit);
        farm.lastWithdrawnProfit = block.timestamp;
        farm.startedRate = getCurrentRate(farm.pairToken);
        emit FarmHarvested(id, farm.mainTokenAmount, farm.pairTokenAmount, farm.pairToken, farm.owner, farm.isWrapped, profit, percent, pairTokenAmountConverted);
    }
    function removeFarm(uint256 id) external {
        Farm storage farm = _farms[id];
        require(farm.owner == msg.sender, "FARM_NOT_OWNER");
        require(!farm.completed, "FARM_COMPLETED");
        (uint256 profit, uint256 pairTokenAmountConverted, uint256 percent) = _getProfit(id);
        if(farm.isWrapped) {
            IWETH(_WETH).withdraw(farm.pairTokenAmount);
            //send ETH to msg.sender
            payable(msg.sender).transfer(farm.pairTokenAmount);
        } else {
            ERC20(farm.pairToken).transfer(msg.sender, farm.pairTokenAmount);
        }
        //transfer mainToken to msg.sender
        farm.completed = true;
        farm.endAt = block.timestamp;
        farm.lastWithdrawnProfit = block.timestamp;
        farm.withdrawnProfit = farm.withdrawnProfit.add(profit);
        farm.startedRate = getCurrentRate(farm.pairToken);
        ERC20(_mainToken).transfer(msg.sender, farm.mainTokenAmount.add(profit));
        emit FarmHarvested(id, farm.mainTokenAmount, farm.pairTokenAmount, farm.pairToken, farm.owner, farm.isWrapped, profit, percent, pairTokenAmountConverted);
        emit FarmRemoved(id, farm.mainTokenAmount, farm.pairTokenAmount, farm.pairToken, farm.owner, farm.isWrapped);
    }
    function getCurrentRate(address token1) public view  returns (uint256) {
        Rate memory rate = _rates[token1];
        uint256 estimatedRate = rate.APR.mul(block.timestamp.sub(rate.timestamp)).div(_period).div(_totalPeriods);
        return rate.totalRate.add(estimatedRate);
    }
    function getRateInfo(address pairToken) external view returns (Rate memory) {
        return _rates[pairToken];
    }
    function setRate(address pairToken, uint256 APR) public onlyOwner {
        require(APR > 0, "APR must be greater than 0");
        _rates[pairToken] = Rate({
            totalRate: getCurrentRate(pairToken),
            timestamp: block.timestamp,
            APR: APR
        });
    }
    function _getProfit(uint256 id) internal view returns (uint256 profit, uint256 pairTokenAmountConverted, uint256 percent) {
        require(id < _farms.length, "FARM_NOT_FOUND");
        Farm memory farm = _farms[id];
        pairTokenAmountConverted = _getAmountOut(farm.pairTokenAmount, farm.pairToken, _mainToken);
        uint256 currentRate = getCurrentRate(farm.pairToken);
        percent = currentRate.sub(farm.startedRate);
        profit = percent.mul(farm.mainTokenAmount.add(pairTokenAmountConverted)).div(_denominator);
    }
    function getProfit(uint256 id) external view returns (uint256 profit, uint256 pairTokenAmountConverted, uint256 percent) {
       return _getProfit(id);
    }
    function getFarm(uint256 id) external view returns (Farm memory) {
        return _farms[id];
    }
    function getFarmsLengthByUser(address user) external view returns (uint256) {
        return _userFarmIds[user].length();
    }
    function getFarmsByUser(address user) external view returns (Farm[] memory) {
        uint256[] memory farmIds = _userFarmIds[user].values();
        Farm[] memory farms = new Farm[](farmIds.length);
        for (uint256 i = 0; i < farmIds.length; i++) {
            farms[i] = _farms[farmIds[i]];
        }
        return farms;
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
    function _getAmountOut(uint256 amountIn, address tokenA, address tokenB) internal view returns (uint256) {
        address[] memory path;
        if(tokenA == _WETH || tokenB == _WETH) {
            path = new address[](2);
            path[0] = tokenA;
            path[1] = tokenB;
            
        } else {
            //[tokenA, _WETH, tokenB];
            path = new address[](3);
            path[0] = tokenA;
            path[1] = _WETH;
            path[2] = tokenB;
        }
        uint256[] memory amounts = IUniswapV2Router01(_pancakeRouterV2).getAmountsOut(amountIn, path);
        return amounts[amounts.length - 1];
        
    }
    function getPriceRate(address tokenA, address tokenB) external view returns (uint256) {
        uint256 amountIn = 10 ** IERC20Metadata(tokenA).decimals();
        return _getAmountOut(amountIn, tokenA, tokenB);
    }
    function getAmountOut(uint256 amountIn, address tokenA, address tokenB) external view returns (uint256) {
        return _getAmountOut(amountIn, tokenA, tokenB);
    }
    function getDenominator() external view returns (uint256) {
        return _denominator;
    }
}
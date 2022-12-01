// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PaymentGateway is Ownable {

    address public receiver;
    mapping(address => bool) isAcceptableToken;

    event DepositToken(address indexed from, address indexed token, uint indexed amount);
    event DepositEther(address indexed from, uint indexed amount);

    constructor(){
        receiver = _msgSender();
    }

    function setAcceptableToken(address _tokenContract) external onlyOwner {
        isAcceptableToken[_tokenContract] = true;
    }
    function removeAcceptableToken(address _tokenContract) external onlyOwner {
        isAcceptableToken[_tokenContract] = false;
    }
    function setReceiver(address _receiver) external onlyOwner {
        receiver = _receiver;
    }

    function depositToken(address _tokenContract,uint256 amount) external {
        require(isAcceptableToken[_tokenContract], "PaymentGateway: token is not acceptable");
        require(amount > 0, "PaymentGateway: amount must be greater than 0");
        require(ERC20(_tokenContract).allowance(_msgSender(), address(this))>= amount, "PaymentGateway: sender does not have enough allowance");
        ERC20(_tokenContract).transferFrom(_msgSender(), receiver, amount);
        emit DepositToken(_msgSender(), _tokenContract, amount);
    }
    function depositEther() external payable {
        require(msg.value > 0, "PaymentGateway: amount must be greater than 0");
        payable(receiver).transfer(msg.value);
        emit DepositEther(_msgSender(), msg.value);
    }

}
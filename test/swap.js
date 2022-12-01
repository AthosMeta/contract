const { expect } = require("chai");
const { ethers, network, waffle } = require("hardhat");
const provider = waffle.provider;
const createFixtureLoader = waffle.createFixtureLoader;
const { v2Fixture } = require('./fixtures/uniswap.js');
const BigNumber = ethers.BigNumber;

describe("Swap", function(){
    let UniswapV2, owner, other, ATM;
    it('deploy contract', async () => {
        [owner, ...other] = await ethers.getSigners();
        const loadFixture = createFixtureLoader([owner], provider)
        UniswapV2 = await loadFixture(v2Fixture);
        
        const DemoToken = await ethers.getContractFactory("DemoToken");
        //deploy ATM token
        ATM = await DemoToken.deploy("Athos Meta","ATM",ethers.utils.parseEther("1000000"));
        console.log("ATM address:",ATM.address);
    });
    it('addLiquidity', async () => {
        const amountEth = ethers.utils.parseEther("10");
        const amountATM = amountEth.mul('3000');// each ETH is 300 BUSD
        //add allowance for BUSD
        await ATM.approve(UniswapV2.router.address, amountATM);
        await UniswapV2.router.addLiquidityETH(ATM.address, amountATM, 0,0, owner.address, (await getTm())+100,  {value: amountEth});
        
    })
    /**
     * Một số lưu ý về tính năng swap:
     * 1.slippageTolerance: khả năng chịu trượt giá - Trong giao dịch, khi nhiều người giao dịch, con số ước tính sẽ không chính xác tuyệt đối,
     * bởi vậy cần có tỷ lệ trượt giá mà người dùng có thể chịu được.
     * 2. ABI có thể lấy tại đây: https://testnet.bscscan.com/address/0xD99D1c33F9fC3444f8101754aBC46c52416550D1#code
     */
    it('swap ETH to ATM', async () => {
        const swapper = other[0];
        const amountEth = ethers.utils.parseEther("1");
        const slippageTolerance = 2; //2%
        const amountATM = (await UniswapV2.router.getAmountsOut(amountEth, [UniswapV2.WETH.address, ATM.address]))[1];
        const amountATMMin = amountATM.sub(amountATM.mul(slippageTolerance).div(100));
        console.log('amountATMMin:',ethers.utils.formatEther(amountATMMin));
        //before swap
        const balanceATMBefore = await ATM.balanceOf(swapper.address);
        const balanceETHBefore = await ethers.provider.getBalance(swapper.address);
        console.log("balanceATMBefore:",ethers.utils.formatEther(balanceATMBefore));
        console.log("balanceETHBefore:",ethers.utils.formatEther(balanceETHBefore));
        //using swapExactETHForTokensSupportingFeeOnTransferTokens
        await UniswapV2.router.connect(swapper).swapExactETHForTokensSupportingFeeOnTransferTokens(amountATMMin,[UniswapV2.WETH.address, ATM.address],swapper.address, (await getTm())+100, {value: amountEth});
        console.log('=============Swapped================');
        //after swap
        const balanceATMAfter = await ATM.balanceOf(swapper.address);
        const balanceETHAfter = await ethers.provider.getBalance(swapper.address);
        console.log("balanceATMAfter:",ethers.utils.formatEther(balanceATMAfter));
        console.log("balanceETHAfter:",ethers.utils.formatEther(balanceETHAfter));
    })
    it('swap ATM to ETH', async () => {
        //sell 1000 ATM to ETH
        const swapper = other[0];
        const amountATM = ethers.utils.parseEther("1000");
        const slippageTolerance = 2; //2%
        const amountETH = (await UniswapV2.router.getAmountsOut(amountATM, [ATM.address, UniswapV2.WETH.address]))[1];
        const amountETHMin = amountETH.sub(amountETH.mul(slippageTolerance).div(100));
        console.log('amountETHMin:',ethers.utils.formatEther(amountETHMin));
        //before swap
        const balanceATMBefore = await ATM.balanceOf(swapper.address);
        const balanceETHBefore = await ethers.provider.getBalance(swapper.address);
        console.log("balanceATMBefore:",ethers.utils.formatEther(balanceATMBefore));
        console.log("balanceETHBefore:",ethers.utils.formatEther(balanceETHBefore));
        //approve ATM to router
        await ATM.connect(swapper).approve(UniswapV2.router.address, amountATM);

        //using swapExactTokensForETHSupportingFeeOnTransferTokens
        await UniswapV2.router.connect(swapper).swapExactTokensForETHSupportingFeeOnTransferTokens(amountATM, amountETHMin, [ATM.address, UniswapV2.WETH.address],swapper.address, (await getTm())+100);
        console.log('=============Swapped================');
        //after swap
        const balanceATMAfter = await ATM.balanceOf(swapper.address);
        const balanceETHAfter = await ethers.provider.getBalance(swapper.address);
        console.log("balanceATMAfter:",ethers.utils.formatEther(balanceATMAfter));
        console.log("balanceETHAfter:",ethers.utils.formatEther(balanceETHAfter));
        const diffETH = balanceETHAfter.sub(balanceETHBefore);
        console.log("diffETH:",ethers.utils.formatEther(diffETH));
    })
})
async function getTm(){
    return (await provider.getBlock('latest')).timestamp;
}
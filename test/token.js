const { expect } = require("chai");
const { ethers, network, waffle } = require("hardhat");
const provider = waffle.provider;
const createFixtureLoader = waffle.createFixtureLoader;
const { v2Fixture } = require('./fixtures/uniswap.js');
const BigNumber = ethers.BigNumber;

describe("Token", function(){
    let UniswapV2, owner, other, ATM;
    it('deploy contract', async () => {
        [owner, ...other] = await ethers.getSigners();
        const loadFixture = createFixtureLoader([owner], provider)
        UniswapV2 = await loadFixture(v2Fixture);
        console.log("Uniswap router", UniswapV2.router.address);
        console.log("Uniswap Factory", UniswapV2.factoryV2.address);
        const Token = await ethers.getContractFactory("Token");
        //deploy ATM token
        ATM = await Token.deploy("Athos Meta","ATM",UniswapV2.router.address);
        console.log("ATM address:",ATM.address);
        console.log("ATM owner:",await ATM.owner());
    });
    it('create LP ', async () => {
        const amountEth = ethers.utils.parseEther("10");
        const amountATM = amountEth.mul('3000');// each ETH is 3000 ATM
        
        const poolCreator = other[0];
        //set poolCreator
        await ATM.setWhoCanCreateLP(poolCreator.address);
        //set excludeTax
        await ATM.excludeTax(poolCreator.address);

        await ATM.connect(owner).transfer(poolCreator.address, amountATM);
        await ATM.connect(poolCreator).approve(UniswapV2.router.address, amountATM);
        const tx = await UniswapV2.router.connect(poolCreator).addLiquidityETH(ATM.address, amountATM, 0,0, poolCreator.address, (await getTm())+100,  {value: amountEth});
        const LPCreated = await ATM.LPCreated();
        console.log("LPCreated:",LPCreated);
        let priceATM = await UniswapV2.router.getAmountsOut(ethers.utils.parseEther('1'), [UniswapV2.WETH.address, ATM.address]);
        console.log("priceATM:",priceATM);
        // add 10 ETH and ATM to LP
        const newAmountATM = await UniswapV2.router.quote(amountEth, amountEth, amountATM);
        console.log(ethers.utils.formatEther(amountEth))
        console.log("newAmountATM:",ethers.utils.formatEther(newAmountATM));
        // add liquidity again 
        ATM.approve(UniswapV2.router.address, newAmountATM);
        await UniswapV2.router.connect(owner).addLiquidityETH(ATM.address, newAmountATM, 0,0, owner.address, (await getTm())+100,  {value: amountEth});
        priceATM = await UniswapV2.router.getAmountsOut(ethers.utils.parseEther('1'), [UniswapV2.WETH.address, ATM.address]);
        console.log("priceATM:",priceATM);
    })
});
async function getTm(){
    return (await provider.getBlock('latest')).timestamp;
}
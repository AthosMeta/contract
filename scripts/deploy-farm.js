const { ethers, network, waffle } = require("hardhat");
const provider = waffle.provider;
const createFixtureLoader = waffle.createFixtureLoader;
const { v2Fixture } = require('./fixtures/uniswap.js');
const BigNumber = ethers.BigNumber;
const config = {
    testnet: {
        deployArgs: {
            mainToken: '0x409E4C112Ab1ed142f9037860e45368AB975CdEC',
            WETH: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
            pancakeRouterV2: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
            denominator: 10000, //denominator of all rate
            period: 86400, // 86400 seconds in a day
            totalPeriods: 365, // 365 days
        },
        pairTokens: [
            {
                address: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
                APR: '10000', // 100% APR
            }
        ]
    },
}

async function main(){
    if(network.name in config){
        const Farms = await ethers.getContractFactory('Farms');
        const farmsInstance = await Farms.deploy(...Object.values(config[network.name].deployArgs));
        console.log('Farms contract deployed at: ', farmsInstance.address);
        for(let i = 0; i < config[network.name].pairTokens.length; i++){
            const pairToken = config[network.name].pairTokens[i];
            await farmsInstance.setRate(pairToken.address, pairToken.APR);
            console.log(`setRate ${pairToken.address} with APR: ${pairToken.APR} and Rate ${pairToken.rate}`);
        }
    }else if (network.name === 'hardhat' || network.name === 'localhost'){
        [owner] = await ethers.getSigners();
        const loadFixture = createFixtureLoader([owner], provider)
        UniswapV2 = await loadFixture(v2Fixture);
        const DemoToken = await ethers.getContractFactory("DemoToken");
        const ATM = await await DemoToken.deploy("Athos Meta","ATM",ethers.utils.parseEther("10000000000"));
        const BUSD = await DemoToken.deploy("BUSD","BUSD",ethers.utils.parseEther("10000000000"));
        const WETH = UniswapV2.WETH;
        console.log("WETH address: ", WETH.address);
        console.log("ATM address: ", ATM.address);
        console.log("BUSD address: ", BUSD.address);
        console.log("UNISWAP ROUTER address: ", UniswapV2.router.address);
        const deployArgs = {
            mainToken: ATM.address,
            WETH: WETH.address,
            pancakeRouterV2: UniswapV2.router.address,
            denominator: 10000, //denominator of all rate
            period: 86400, // 86400 seconds in a day
            totalPeriods: 365, // 365 days
        }
        //add Liquidity with rate 1ETH: 1000 BUSD
        const amountEth = ethers.utils.parseEther("100");
        const amountBUSD = amountEth.mul('1000');// each ETH is 1000 BUSD
        await BUSD.approve(UniswapV2.router.address, amountBUSD);
        await UniswapV2.router.addLiquidityETH(BUSD.address, amountBUSD, 0,0, owner.address, getTm()+100,  {value: amountEth});
        // get price ETH/BUSD
        const prices = await UniswapV2.router.getAmountsOut(ethers.utils.parseEther('1'), [WETH.address, BUSD.address]);
        console.log('1 ETH =',ethers.utils.formatEther(prices[1]), 'BUSD');

        //add Liquidity with rate 1ETH: 5000 ATM
        const amountATM = amountEth.mul('5000');
        await ATM.approve(UniswapV2.router.address, amountATM);
        await UniswapV2.router.addLiquidityETH(ATM.address, amountATM, 0,0, owner.address, getTm()+100,  {value: amountEth});
        // get price ETH/ATM
        const prices2 = await UniswapV2.router.getAmountsOut(ethers.utils.parseEther('1'), [WETH.address, ATM.address]);
        console.log('1 ETH =',ethers.utils.formatEther(prices2[1]), 'ATM');

        const Farms = await ethers.getContractFactory('Farms');
        const farmsInstance = await Farms.deploy(...Object.values(deployArgs));
        console.log('Farms contract deployed at: ', farmsInstance.address);
        const pairTokens = [
            {
                address: BUSD.address,
                APR: '5000', // 50% APR
            },{
                address: WETH.address,
                APR: '10000', // 100% APR
            }
        ]
        for(let i = 0; i < pairTokens.length; i++){
            const pairToken = pairTokens[i];
            await farmsInstance.setRate(pairToken.address, pairToken.APR);
            console.log(`setRate ${pairToken.address} with APR: ${pairToken.APR}`);
        }
        //transfer ATM to farmsInstance
        await ATM.transfer(farmsInstance.address, ethers.utils.parseEther("1000000000"));
        //check balance ATM of farmsInstance
        let balanceATM = await ATM.balanceOf(farmsInstance.address);
        console.log("ATM balance of farmsInstance: ", ethers.utils.formatEther(balanceATM));
    }else{
        throw new Error(`Network ${network.name} not supported`);
    }
}
function getTm(){
  return Math.floor(Date.now() / 1000);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

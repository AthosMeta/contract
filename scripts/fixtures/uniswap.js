//const {expect} = require('chai');
const { ethers, waffle } = require("hardhat");
const deployContract = waffle.deployContract;
//const {deployContract} = require('ethereum-waffle');
const provider = waffle.provider;

const UniswapV2Factory =  require('@uniswap/v2-core/build/UniswapV2Factory.json');
const IUniswapV2Pair =  require('@uniswap/v2-core/build/IUniswapV2Pair.json');
const ERC20 =  require('@uniswap/v2-periphery/build/ERC20.json');
const WETH9 =  require('@uniswap/v2-periphery/build/WETH9.json');
const UniswapV1Exchange =  require('@uniswap/v2-periphery/build/UniswapV1Exchange.json');
const UniswapV1Factory =  require('@uniswap/v2-periphery/build/UniswapV1Factory.json');
const UniswapV2Router01 =  require('@uniswap/v2-periphery/build/UniswapV2Router01.json');
const UniswapV2Migrator =  require('@uniswap/v2-periphery/build/UniswapV2Migrator.json');
const UniswapV2Router02 =  require('@uniswap/v2-periphery/build/UniswapV2Router02.json');
const RouterEventEmitter =  require('@uniswap/v2-periphery/build/RouterEventEmitter.json');




const expandTo18Decimals = (amount) => ethers.utils.parseEther(''+amount);
const overrides = {
    gasLimit: 999999999
}
async function v2Fixture([wallet], provider) {
    // deploy tokens
    console.log(wallet.address);
    console.log('Deploying tokens...');
    const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
    const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
    const WETH = await deployContract(wallet, WETH9)
    const WETHPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
    
    // deploy V1
    console.log('Deploying V1...');
    const factoryV1 = await deployContract(wallet, UniswapV1Factory, [])
    await factoryV1.initializeFactory((await deployContract(wallet, UniswapV1Exchange, [])).address)
    // deploy V2
    console.log('Deploying V2...');
    const factoryV2 = await deployContract(wallet, UniswapV2Factory, [wallet.address])

    // deploy routers
    console.log('Deploying routers...');
    const router01 = await deployContract(wallet, UniswapV2Router01, [factoryV2.address, WETH.address])
    const router02 = await deployContract(wallet, UniswapV2Router02, [factoryV2.address, WETH.address])

    // event emitter for testing
    console.log('Deploying event emitter...');
    const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

    // deploy migrator
    console.log('Deploying migrator...');
    const migrator = await deployContract(wallet, UniswapV2Migrator, [factoryV1.address, router01.address])

    /* // initialize V1
    console.log('Initializing V1...');
    await factoryV1.createExchange(WETHPartner.address,{gasLimit: '999999999999999'})
    const WETHExchangeV1Address = await factoryV1.getExchange(WETHPartner.address)
    const WETHExchangeV1 = new Contract(WETHExchangeV1Address, JSON.stringify(UniswapV1Exchange.abi), provider).connect(
        wallet
    ) */

    // initialize V2
    console.log('Initializing V2...');
    await factoryV2.createPair(tokenA.address, tokenB.address)
    const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address)
    const pair = new ethers.Contract(pairAddress, JSON.stringify(IUniswapV2Pair.abi), provider).connect(wallet)

    const token0Address = await pair.token0()
    const token0 = tokenA.address === token0Address ? tokenA : tokenB
    const token1 = tokenA.address === token0Address ? tokenB : tokenA

    await factoryV2.createPair(WETH.address, WETHPartner.address)
    const WETHPairAddress = await factoryV2.getPair(WETH.address, WETHPartner.address)
    const WETHPair = new ethers.Contract(WETHPairAddress, JSON.stringify(IUniswapV2Pair.abi), provider).connect(wallet)

    /* // using router02 to create liquidity TokenA -> WETH
    console.log('Creating liquidity...');
    const amountToken = expandTo18Decimals(100);
    const amountWETH = expandTo18Decimals(1);
    const deadline = (await provider.getBlock('latest')).timestamp + 360;
    //approve
    await WETHPartner.approve(router02.address, amountToken);
    console.log('Approved');
    const tx = await router02.addLiquidityETH(
        WETHPartner.address,
        amountToken,
        0,
        0,
        wallet.address,
        deadline,
        {
            value: amountWETH
        }
    );
    console.log(tx);
    const receipt = await tx.wait();
    //console.log(receipt.events);
    const WETHPairAddress = await factoryV2.getPair(WETH.address, WETHPartner.address)
    const WETHPair = new ethers.Contract(WETHPairAddress, JSON.stringify(IUniswapV2Pair.abi), provider).connect(wallet)
    const balanceLP = await WETHPair.balanceOf(wallet.address);
    console.log('balanceLP', balanceLP.toString()); */

    return {
        token0,
        token1,
        WETH,
        WETHPartner,
        factoryV1,
        factoryV2,
        router01,
        router02,
        router: router02, // the default router, 01 had a minor bug
        routerEventEmitter,
        migrator,
        //WETHExchangeV1,
        pair,
        WETHPair
    }
}
module.exports = {v2Fixture}
const { expect } = require("chai");
const { ethers, network, waffle } = require("hardhat");
const provider = waffle.provider;
const createFixtureLoader = waffle.createFixtureLoader;
const { v2Fixture } = require('./fixtures/uniswap.js');
const BigNumber = ethers.BigNumber;
describe("Farms", function () {
  let farmsInstance, WETHInstance, mainTokenInstance, owner, other, DemoToken, BUSD;
  const APROfETH = BigNumber.from(100000); // 100% APR
  let config;
  it('deploy contract', async () => {
    [owner, ...other] = await ethers.getSigners();
    
    const loadFixture = createFixtureLoader([owner], provider)
    UniswapV2 = await loadFixture(v2Fixture);
    WETHInstance = UniswapV2.WETH;
    //console.log(WETHInstance.address);
    DemoToken = await ethers.getContractFactory("DemoToken");
    mainTokenInstance = await DemoToken.deploy("Athos Meta","ATM",ethers.utils.parseEther("1000000"));
    //console.log(mainTokenInstance.address);
    //console.log(await mainTokenInstance.name())
    const farms = await ethers.getContractFactory("Farms");
    config = {
      mainToken: mainTokenInstance.address,
      WETH: WETHInstance.address,
      router: UniswapV2.router.address,
      denominator: 100000,
      period: 86400, // 86400 seconds in a day
      totalPeriods: 365, // 365 days
    }
    farmsInstance = await farms.deploy(...Object.values(config));
    console.log(farmsInstance.address);
    await farmsInstance.setRate(WETHInstance.address, APROfETH);
    //transfer 10000 to farms
    await mainTokenInstance.transfer(farmsInstance.address, ethers.utils.parseEther("10000"));
  });
  it('deploy some token and addLiquidity to router', async () => {
    //create BUSD token
    BUSD = await DemoToken.deploy("BUSD","BUSD",ethers.utils.parseEther("10000000000"));
    //create pair BUSD/ETH
    const amountEth = ethers.utils.parseEther("10");
    const amountBUSD = amountEth.mul('300');// each ETH is 300 BUSD
    //add allowance for BUSD
    await BUSD.approve(UniswapV2.router.address, amountBUSD);
    await UniswapV2.router.addLiquidityETH(BUSD.address, amountBUSD, 0,0, owner.address, await getTm(100),  {value: amountEth});
    // add main token to router
    const amountETHForMainToken = ethers.utils.parseEther("10");
    const amountMainToken = amountETHForMainToken.mul('3000'); // each ETH is 3000 main token
    await mainTokenInstance.approve(UniswapV2.router.address, amountMainToken);
    await UniswapV2.router.addLiquidityETH(mainTokenInstance.address, amountMainToken, 0,0, owner.address, await getTm(100), {value: amountETHForMainToken});

    // get price ETH/BUSD
    const prices = await UniswapV2.router.getAmountsOut(ethers.utils.parseEther('1'), [WETHInstance.address, BUSD.address]);
    console.log('1 ETH =',ethers.utils.formatEther(prices[1]), 'BUSD');

    // get price ETH/MainToken
    const prices2 = await UniswapV2.router.getAmountsOut(ethers.utils.parseEther('1'), [WETHInstance.address, mainTokenInstance.address]);
    console.log('1 ETH =',ethers.utils.formatEther(prices2[1]), 'MainToken');

    // get price BUSD/MainToken
    const prices3 = await UniswapV2.router.getAmountsOut(ethers.utils.parseEther('1'), [BUSD.address, WETHInstance.address, mainTokenInstance.address]);
    console.log('1 BUSD =',ethers.utils.formatEther(prices3[2]), 'MainToken');
    //using FarmsInstance to get price
    const prices4 = await farmsInstance.getPriceRate(BUSD.address, mainTokenInstance.address);
    console.log('1 BUSD =',ethers.utils.formatEther(prices4), 'MainToken');
  })
  it('get rateInfo', async () => {
    let rateInfo = await farmsInstance.getRateInfo(WETHInstance.address);
    expect(rateInfo.APR.eq(APROfETH)).to.equal(true);
    let currentRate = await farmsInstance.getCurrentRate(WETHInstance.address);
    await sleep(30*86400);
    console.log('sleep 30 days');
    currentRate = await farmsInstance.getCurrentRate(WETHInstance.address);
    expect(currentRate.eq(APROfETH.mul(30).div(config.totalPeriods))).to.equal(true);
    console.log("ETH-AMT rate:",currentRate.toString());
    rateInfo = await farmsInstance.getRateInfo(WETHInstance.address);
    console.log("ETH-ATM Total Rate:",rateInfo.totalRate.toString());
    await farmsInstance.setRate(WETHInstance.address, '50000');
    await sleep(30*86400);
    console.log("wait 30 days");
    rateInfo = await farmsInstance.getRateInfo(WETHInstance.address);
    console.log("ETH-ATM Total Rate:",rateInfo.totalRate.toString());
    currentRate = await farmsInstance.getCurrentRate(WETHInstance.address);
    console.log("ETH-AMT rate:",currentRate.toString());
    await farmsInstance.setRate(WETHInstance.address, APROfETH);
  })
  //farm
  it('farm ETH', async () => {
    const farmer = other[0];
    //transfer 10000 token to farmer
    await mainTokenInstance.transfer(farmer.address, ethers.utils.parseEther("10000"));
    const priceRate = await farmsInstance.getPriceRate(mainTokenInstance.address, WETHInstance.address);
    const farm = {
      mainTokenAmount: null,
      WETHAmount: ethers.utils.parseEther("0.3"),
    }
    farm.mainTokenAmount = await farmsInstance.getAmountOut(farm.WETHAmount, config.WETH, config.mainToken);
    console.log("farm.mainTokenAmount:",ethers.utils.formatEther(farm.mainTokenAmount));
    //allow farmer to farm of mainToken
    await mainTokenInstance.connect(farmer).approve(farmsInstance.address, farm.mainTokenAmount);

    let tx = await farmsInstance.connect(farmer).createFarmWithEth(farm.mainTokenAmount, {value: farm.WETHAmount});
    //get event from tx
    let receipt = await tx.wait();
    let event = receipt.events.find(e => e.event === 'FarmCreated');
    //console.log(event.args);
    const farmId = event.args.id;
    //getFarmsByUser
    let farms = await farmsInstance.getFarmsByUser(farmer.address);
    //console.log(farms);
    let balance = await mainTokenInstance.balanceOf(farmer.address);
    //console.log(balance.toString());
    balance = await mainTokenInstance.balanceOf(farmsInstance.address);
    //console.log(balance.toString());
    await sleep(30*86400);
    //get profit
    let {profit} = await farmsInstance.getProfit(farmId);
    console.log("Profit",ethers.utils.formatEther(profit));
    //check profit
    const pairTokenAmountConverted = await farmsInstance.getAmountOut(farm.WETHAmount, config.WETH, config.mainToken);
    const rate = APROfETH.mul(30).div(config.totalPeriods);
    const realProfit = pairTokenAmountConverted.add(farm.mainTokenAmount).mul(rate).div(config.denominator);
    console.log("Real Profit",ethers.utils.formatEther(realProfit));
    expect(profit.eq(realProfit)).to.equal(true,`profit is not equal to real profit, profit: ${ethers.utils.formatEther(profit)}, real profit: ${ethers.utils.formatEther(realProfit)}`);
    let etherBalance = await ethers.provider.getBalance(farmer.address);
    let tokenBalance1 = await mainTokenInstance.balanceOf(farmer.address);
    console.log('ether: ' + ethers.utils.formatEther(etherBalance));
    console.log('token: ' + ethers.utils.formatEther(tokenBalance1));
    // try harvest farm
    tx = await farmsInstance.connect(farmer).harvest(farmId);
    receipt = await tx.wait();
    event = receipt.events.find(e => e.event === 'FarmHarvested');
    //console.log(event.args);
    etherBalance = await ethers.provider.getBalance(farmer.address);
    let tokenBalance2 = await mainTokenInstance.balanceOf(farmer.address);
    console.log('ether: ' + ethers.utils.formatEther(etherBalance));
    console.log('token: ' + ethers.utils.formatEther(tokenBalance2));
    //check diff between ether and token
    expect(tokenBalance2.sub(tokenBalance1).eq(realProfit)).to.equal(true);
    //=======================


    //after 30 days, change price
    console.log("==============================\nafter 30 days, change price");
    await sleep(30*86400);
    console.log("wait 30 days");
    //change price
    //Buy 5 ETH for ATM
    // get amountsOut of ETH/MainToken
    const amounts = await UniswapV2.router.getAmountsOut(ethers.utils.parseEther('5'), [WETHInstance.address, mainTokenInstance.address]);
    const amountTokenSwap = amounts[1];
    //swap
    await UniswapV2.router.connect(owner).swapExactETHForTokens(amountTokenSwap, [WETHInstance.address, mainTokenInstance.address], owner.address, await getTm(100), { value: ethers.utils.parseEther('5')} ).then().catch(err =>{
      expect.fail(`Swap error: ${err.message}`);
    });
    // get price ETH/MainToken
    const prices2 = await UniswapV2.router.getAmountsOut(ethers.utils.parseEther('1'), [WETHInstance.address, mainTokenInstance.address]);
    console.log('1 ETH =',ethers.utils.formatEther(prices2[1]), 'MainToken');
    //get profit
    const {profit: profitAfter30days} = await farmsInstance.getProfit(farmId);
    profit = profitAfter30days;
    console.log("Profit",ethers.utils.formatEther(profit));
    //harvest farm
    await farmsInstance.connect(farmer).harvest(farmId).then().catch(err =>{
      expect.fail(`Harvest error: ${err.message}`);
    });
    console.log("==============================");
    //after 15 days, change rate to 50000
    const APRAfter15Days = BigNumber.from(50000);
    await sleep(15*86400);
    await farmsInstance.setRate(WETHInstance.address, APRAfter15Days);
    const APRAfter30Days = BigNumber.from(75000);
    await sleep(15*86400);
    await farmsInstance.setRate(WETHInstance.address, APRAfter30Days);
    await sleep(15*86400);
    //calculate real profit after 45 days
    const rate45Days = APROfETH.mul(15).add(APRAfter15Days.mul(15)).add(APRAfter30Days.mul(15)).div(config.totalPeriods);
    const realProfitAfter45Days = pairTokenAmountConverted.add(farm.mainTokenAmount).mul(rate45Days).div(config.denominator);
    console.log("Real Profit after 45 days",ethers.utils.formatEther(realProfitAfter45Days));
    //check profit after 45 days
    const {profit: profitAfter45days} = await farmsInstance.getProfit(farmId);
    profit = profitAfter45days;
    console.log("Profit after 45 days",ethers.utils.formatEther(profit));

    //harvest farm again
    await farmsInstance.connect(farmer).harvest(farmId).then().catch(err => {
      expect.fail(err.message);
    });
    //set rate APROfETH
    await farmsInstance.setRate(WETHInstance.address, APROfETH);




    console.log("==============================");
    //check profit after 60 days
    await sleep(60*86400);
    //remove farm
    const {profit:profitAfter60Days} = await farmsInstance.getProfit(farmId);
    console.log("Profit after 60 days",ethers.utils.formatEther(profitAfter60Days));
    let beforeETHBalance = await ethers.provider.getBalance(farmer.address);
    let beforeTokenBalance = await mainTokenInstance.balanceOf(farmer.address);
    await farmsInstance.connect(farmer).removeFarm(farmId).then().catch(err => {
      expect.fail(err.message);
    });
    let afterETHBalance = await ethers.provider.getBalance(farmer.address);
    let afterTokenBalance = await mainTokenInstance.balanceOf(farmer.address);
    const withdrawnETH = afterETHBalance.sub(beforeETHBalance);
    const withdrawnToken = afterTokenBalance.sub(beforeTokenBalance);
    
    console.log("Withdrawn Token:",ethers.utils.formatEther(withdrawnToken));
    console.log("Calculated Withdrawn Token:",ethers.utils.formatEther(profitAfter60Days.add(farm.mainTokenAmount)));

    console.log("Withdrawn ETH:",ethers.utils.formatEther(withdrawnETH));
    console.log("Calculated Withdrawn ETH:", ethers.utils.formatEther(farm.WETHAmount));
    expect(profitAfter60Days.add(farm.mainTokenAmount).eq(withdrawnToken)).to.equal(true, "profit after 60 days is not equal to withdrawn token");
    expect(withdrawnETH.lt(farm.WETHAmount)).to.equal(true, "withdrawn ETH is not equal to farm WETHAmount");
    //try remove farm again
    await farmsInstance.connect(farmer).removeFarm(farmId).then(()=>{
      expect.fail("farm can be removed only once");
    }).catch(err => {
      expect(err.message).to.contains("revert", err.message);
    });
  });
  it('farm BUSD', async () => {
    console.log("==============================");
    //set rate for BUSD: 100% APR
    const APROfBUSD = BigNumber.from(100000);
    await farmsInstance.setRate(BUSD.address, APROfBUSD);
    const farmer = other[0];
    //transfer 10000 BUSD to farmer
    await BUSD.transfer(farmer.address, ethers.utils.parseEther("10000"));
    await mainTokenInstance.transfer(farmer.address, ethers.utils.parseEther("10000"));

    
    const params = {
      mainTokenAmount: null,
      pairTokenAmount: ethers.utils.parseEther("300"),
      pairToken: BUSD.address,
    }
    params.mainTokenAmount = await farmsInstance.getAmountOut(params.pairTokenAmount, params.pairToken, config.mainToken);
    console.log("Pair Token Amount:",ethers.utils.formatEther(params.pairTokenAmount));
    console.log("Main Token Amount:",ethers.utils.formatEther(params.mainTokenAmount));
    //allow farmer to farm of mainToken
    await mainTokenInstance.connect(farmer).approve(farmsInstance.address, params.mainTokenAmount);
    await BUSD.connect(farmer).approve(farmsInstance.address, params.pairTokenAmount);
    // createFarmWithToken
    let tx = await farmsInstance.connect(farmer).createFarmWithToken(params.mainTokenAmount, params.pairTokenAmount, params.pairToken);
    //get event from tx
    let receipt = await tx.wait();
    let event = receipt.events.find(e => e.event === 'FarmCreated');
    //console.log("FarmCreated",event.args);
    const farmId = event.args.id;
    await sleep(30*86400); //sleep 30 days
    //get profit
    let {profit} = await farmsInstance.getProfit(farmId);
    console.log("Profit:",ethers.utils.formatEther(profit));
    //harvest token
    tx = await farmsInstance.connect(farmer).harvest(farmId);
    receipt = await tx.wait();
    event = receipt.events.find(e => e.event === 'FarmHarvested');
    //console.log("FarmHarvested Event",event.args);
    //get profit
    //show BUSD balance
    let BUSDBalance = await BUSD.balanceOf(farmer.address);
    console.log("BUSD Balance:",ethers.utils.formatEther(BUSDBalance));
    //show mainToken balance
    let mainTokenBalance = await mainTokenInstance.balanceOf(farmer.address);
    console.log("MainToken Balance:",ethers.utils.formatEther(mainTokenBalance));

    //after 30 days, change price
    await sleep(30*86400);
    console.log("===============Change Price of BUSD/ETH===============");

    // get amountsOut of BUSD/ETH
    const amountBUSDforSwap = ethers.utils.parseEther("1000");
    const amounts = await UniswapV2.router.getAmountsOut(amountBUSDforSwap, [BUSD.address, WETHInstance.address]);
    const amountTokenSwap = amounts[1];
    //allow router transfer BUSD
    await BUSD.connect(owner).approve(UniswapV2.router.address, amountBUSDforSwap);
    //swap
    await UniswapV2.router.connect(owner).swapExactTokensForETH(amountBUSDforSwap, amountTokenSwap, [ BUSD.address, WETHInstance.address], owner.address, await getTm(100), {gasLimit: 200000}).then().catch(err =>{
      expect.fail(`Swap error: ${err.message}`);
    });
    // get price BUSD/ETH
    const prices2 = await UniswapV2.router.getAmountsOut(ethers.utils.parseEther('1'), [BUSD.address, WETHInstance.address, mainTokenInstance.address]);
    console.log("1 BUSD:",ethers.utils.formatEther(prices2[2]), "ATM");
    //get profit
    let {profit:profitAfter30Days} = await farmsInstance.getProfit(farmId);
    console.log("Profit after 30 days",ethers.utils.formatEther(profitAfter30Days));
  });
});
async function sleep(seconds){
  await network.provider.request({
    method: "evm_increaseTime",
    params: [seconds],
  }); // add 10 seconds block.timestamp;
  await network.provider.send("evm_mine", []);
}
async function getTm(addTime = 0){
  const latestBlock = await hre.ethers.provider.getBlock("latest")
  return latestBlock.timestamp + addTime;
}
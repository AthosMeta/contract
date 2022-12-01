const { expect } = require("chai");
const { ethers, network, waffle } = require("hardhat");
const provider = waffle.provider;
const createFixtureLoader = waffle.createFixtureLoader;
const { v2Fixture } = require('./fixtures/uniswap.js');
const BigNumber = ethers.BigNumber;

describe("Stake", function () {
    let StakeInstance, WETHInstance, mainTokenInstance, owner, holder, DemoToken, BUSD, rates;
    it('deploy contract', async () => {
        [owner, holder,] = await ethers.getSigners();
        const loadFixture = createFixtureLoader([owner], provider)
        UniswapV2 = await loadFixture(v2Fixture);
        WETHInstance = UniswapV2.WETH;

        DemoToken = await ethers.getContractFactory("DemoToken");
        mainTokenInstance = await DemoToken.deploy("Athos Meta","ATM",ethers.utils.parseEther("1000000"));
        BUSD = await DemoToken.deploy("BUSD","BUSD",ethers.utils.parseEther("10000000000"));
        const Stake = await ethers.getContractFactory("Stake");
        const config = {
            WETH: WETHInstance.address,
            denominator: 10000,
            period: 86400, // 86400 seconds in a day
            totalPeriods: 365, // 365 days
            feeEarlyWithdraw: 1000, // 10% fee early withdraw
        }
        StakeInstance = await Stake.deploy(...Object.values(config));

    });
    it('rate', async () => {
        rates = [
            {
                token: mainTokenInstance.address,
                APR: 10000, // 100% APR
                period: 182,
                withdrawFee: 0,
            },
            {
                token: mainTokenInstance.address,
                APR: 12000, // 120% APR
                period: 365,
                withdrawFee: 0,
            },
            {
                token: BUSD.address,
                APR: 5000, // 50% APR
                period: 182,
                withdrawFee: 300, // 3% of profit 
            },
            {
                token: BUSD.address,
                APR: 6000, // 60% APR
                period: 365,
                withdrawFee: 300,
            },
            {
                token: WETHInstance.address,
                APR: 5000, // 50% APR
                period: 182,
                withdrawFee: 300, // 3% of profit 
            },
            {
                token: WETHInstance.address,
                APR: 6000, // 60% APR
                period: 365,
                withdrawFee: 300,
            }
        ]
        for(let i = 0; i < rates.length; i++){
            await StakeInstance.setRate(rates[i].token, rates[i].APR, rates[i].period, rates[i].withdrawFee);
        }
        //get rate
        const rate1 = await StakeInstance.getRate(mainTokenInstance.address, 182);
        console.log(rate1);
        const rate2 = await StakeInstance.getRate(BUSD.address, 365);
        console.log(rate2);
    })

    it('stake BUSD', async () => {
        //transfer some BUSD to stakeInstance
        await BUSD.transfer(StakeInstance.address, ethers.utils.parseEther("1000000"));
        //transfer some BUSD to holder
        await BUSD.transfer(holder.address, ethers.utils.parseEther("1000000"));
        //stake BUSD
        const stakeInfo = rates[2]
        //set allowance
        await BUSD.connect(holder).approve(StakeInstance.address, ethers.utils.parseEther("1000000"));
        let tx = await StakeInstance.connect(holder).createStakeToken(BUSD.address, ethers.utils.parseEther("1000000"), stakeInfo.period);
        //track event StakingCreated
        let receipt = await tx.wait();
        let event = receipt.events.find(e => e.event === 'StakingCreated');
        const id = event.args.id;
        expect(event.args.token).to.equal(BUSD.address);
        expect(event.args.owner).to.equal(holder.address);
        expect(event.args.amount).to.equal(ethers.utils.parseEther("1000000"));
        expect(event.args.period).to.equal(stakeInfo.period);
        expect(event.args.APR).to.equal(stakeInfo.APR);
        // getStakingOfId
        const staking = await StakeInstance.getStakingOfId(id);
        expect(staking.token).to.equal(BUSD.address);
        expect(staking.owner).to.equal(holder.address);
        expect(staking.amount).to.equal(ethers.utils.parseEther("1000000"));
        expect(staking.period).to.equal(stakeInfo.period);
        expect(staking.APR).to.equal(stakeInfo.APR);
        // withdrawProfit after 1 day
        console.log("======================= withdrawProfit after 1 day =======================");
        await sleep(86400);
        tx = await StakeInstance.connect(holder).withdrawProfit(id);
        receipt = await tx.wait();
        event = receipt.events.find(e => e.event === 'WithdrawProfit');
        //console.log(event.args);
        expect(event.args.id).to.equal(id);
        expect(event.args.token).to.equal(BUSD.address);
        console.log("profit after 1 day: ", ethers.utils.formatEther(event.args.profit));

        //withdrawProfit after 2 days
        console.log("======================= withdrawProfit after 2 days (day 3) =======================");
        await sleep(86400*2);
        //get balance BUSD of holder
        let balance = await BUSD.balanceOf(holder.address);
        console.log("balance BUSD of holder: ", ethers.utils.formatEther(balance));
        tx = await StakeInstance.connect(holder).withdrawProfit(id);
        receipt = await tx.wait();
        event = receipt.events.find(e => e.event === 'WithdrawProfit');
        //console.log(event.args);
        expect(event.args.id).to.equal(id);
        expect(event.args.token).to.equal(BUSD.address);
        console.log("profit after 2 days: ", ethers.utils.formatEther(event.args.profit));
        let balance2 = await BUSD.balanceOf(holder.address);
        console.log("balance BUSD of holder: ", ethers.utils.formatEther(balance2));
        expect(balance2.sub(balance).toString()).to.equal(event.args.profit);
        //earlyWithdraw after 1 day
        console.log("======================= earlyWithdraw after 1 day (day 4) =======================");
        await sleep(86400);
        tx = await StakeInstance.connect(holder).earlyUnstake(id);
        receipt = await tx.wait();
        event = receipt.events.find(e => e.event === 'StakingCompleted');
        expect(event.args.id).to.equal(id);
        expect(event.args.token).to.equal(BUSD.address);
        expect(event.args.amount).to.equal(ethers.utils.parseEther("1000000").mul('9').div('10'));
        withdrawProfitEvent = receipt.events.find(e => e.event === 'WithdrawProfit');
        expect(withdrawProfitEvent.args.id).to.equal(id);
        let balance3 = await BUSD.balanceOf(holder.address);
        expect(balance3.sub(balance2)).to.equal(event.args.amount.add(withdrawProfitEvent.args.profit));
        console.log("balance BUSD of holder: ", ethers.utils.formatEther(balance3));
    });
    it('stake WETH', async () => {
        //owner deposit some WETH
        await WETHInstance.deposit({value: ethers.utils.parseEther("100")});
        //transfer some WETH to stakeInstance
        await WETHInstance.transfer(StakeInstance.address, ethers.utils.parseEther("100"));

        // createStakeEth
        const stakeInfo = rates[4];
        let tx = await StakeInstance.connect(holder).createStakeEth(stakeInfo.period,{value: ethers.utils.parseEther("100")});
        let receipt = await tx.wait();
        let event = receipt.events.find(e => e.event === 'StakingCreated');
        const id = event.args.id;
        expect(event.args.token).to.equal(WETHInstance.address);
        expect(event.args.owner).to.equal(holder.address);
        expect(event.args.amount).to.equal(ethers.utils.parseEther("100"));
        expect(event.args.period).to.equal(stakeInfo.period);
        expect(event.args.APR).to.equal(stakeInfo.APR);
        
        // getStakingOfId
        const staking = await StakeInstance.getStakingOfId(id);
        expect(staking.token).to.equal(WETHInstance.address);
        expect(staking.owner).to.equal(holder.address);
        expect(staking.amount).to.equal(ethers.utils.parseEther("100"));
        expect(staking.period).to.equal(stakeInfo.period);
        expect(staking.APR).to.equal(stakeInfo.APR);

        // withdrawProfit after 1 day
        console.log("======================= withdrawProfit after 1 day =======================");
        await sleep(86400);
        tx = await StakeInstance.connect(holder).withdrawProfit(id);
        receipt = await tx.wait();
        event = receipt.events.find(e => e.event === 'WithdrawProfit');
        //console.log(event.args);
        expect(event.args.id).to.equal(id);
        expect(event.args.token).to.equal(WETHInstance.address);
        console.log("profit after 1 day: ", ethers.utils.formatEther(event.args.profit));

        //withdrawProfit after 2 days
        console.log("======================= withdrawProfit after 2 days (day 3) =======================");
        await sleep(86400*2);
        //get etherBalance of holder
        let balance =  await ethers.provider.getBalance(holder.address);
        console.log("balance WETH of holder: ", ethers.utils.formatEther(balance));
        tx = await StakeInstance.connect(holder).withdrawProfit(id);
        receipt = await tx.wait();
        event = receipt.events.find(e => e.event === 'WithdrawProfit');
        //console.log(event.args);
        expect(event.args.id).to.equal(id);
        expect(event.args.token).to.equal(WETHInstance.address);
        console.log("profit after 2 days: ", ethers.utils.formatEther(event.args.profit));
        let balance2 =  await ethers.provider.getBalance(holder.address);
        console.log("balance WETH of holder: ", ethers.utils.formatEther(balance2));

        //unstake after 180 days
        console.log("======================= withdrawProfit after 180 days (day 183) =======================");
        await sleep(86400*180);
        //get etherBalance of holder
        let balance3 =  await ethers.provider.getBalance(holder.address);
        console.log("balance WETH of holder: ", ethers.utils.formatEther(balance3));
        tx = await StakeInstance.connect(holder).unstake(id);
        receipt = await tx.wait();
        event = receipt.events.find(e => e.event === 'StakingCompleted');
        expect(event.args.id).to.equal(id);
        expect(event.args.token).to.equal(WETHInstance.address);
        console.log("Principal:", ethers.utils.formatEther(event.args.amount));
        const withdrawProfitEvent = receipt.events.find(e => e.event === 'WithdrawProfit');
        console.log("Profit:", ethers.utils.formatEther(withdrawProfitEvent.args.profit));

        //get etherBalance of holder
        let balance4 =  await ethers.provider.getBalance(holder.address);
        console.log("balance WETH of holder: ", ethers.utils.formatEther(balance4));
    })
    it('getStakingOfUser', async () => {
        const stakes = await StakeInstance.getStakingOfUser(holder.address);
        expect(stakes.length).to.equal(2);
        expect(stakes[0].token).to.equal(BUSD.address);
        expect(stakes[1].token).to.equal(WETHInstance.address);
        //check completed is true
        expect(stakes[0].completed).to.equal(true);
        expect(stakes[1].completed).to.equal(true);
    })
    it('get Events', async () => {
        //log holder address
        console.log("holder address: ", holder.address);
        const filter = await StakeInstance.filters.StakingCreated(null,holder.address);
        const events = await StakeInstance.queryFilter(filter);
        console.log("StakingCreated events: ");
        const allStakingOfHolder = await Promise.all(events.map(async e => {
            //console.log(e);
            return {
                id: e.args.id.toString(),
                token: e.args.token,
                owner: e.args.owner,
                amount: e.args.amount.toString(),
                period: e.args.period.toString(),
                APR: e.args.APR.toString(),
                tm: (await provider.getBlock(e.blockNumber)).timestamp,
            }
        }));
        console.table(allStakingOfHolder);
        //stake WETH Profit withdraw
        const filter2 = await StakeInstance.filters.WithdrawProfit(1);
        const events2 = await StakeInstance.queryFilter(filter2);
        console.log("WithdrawProfit events: ");
        const allWithdrawProfit = await Promise.all(events2.map(async e => {
            //console.log(e);
            return {
                id: e.args.id.toString(),
                token: e.args.token,
                owner: e.args.owner,
                profit: e.args.profit.toString(),
                tm: (await provider.getBlock(e.blockNumber)).timestamp,
            }
        }));
        console.table(allWithdrawProfit);
    

    })
});

async function sleep(seconds){
    await network.provider.request({
      method: "evm_increaseTime",
      params: [seconds],
    }); // add 10 seconds block.timestamp;
    await network.provider.send("evm_mine", []);
  }
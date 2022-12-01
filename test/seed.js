const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
const assert = require("assert");

describe("SeedRound", function () {
    let accounts, ATM, SeedRound, owner, minBuy, maxBuy;
    const totalSupply = ethers.utils.parseEther("600000000");
    const tokenPerBnb = 150000;
    const timeStart = Math.floor(Date.now() / 1000) + 86400;
    // set timeEnd to 2 days from now
    const timeEnd = Math.floor(Date.now() / 1000) + 172800;
    let contributes;
    it('deploys', async function () {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        const DemoToken = await ethers.getContractFactory("DemoToken");
        const SeedRoundContract = await ethers.getContractFactory("SeedRound");
        
        ATM = await DemoToken.deploy("Athos Meta", "ATM", totalSupply);
        
        SeedRound = await SeedRoundContract.deploy(ATM.address, tokenPerBnb);
        // get token and tokenPerBnb
        const tokenInContract = await SeedRound.token();
        const tokenPerBnbInContract = await SeedRound.tokensPerBnb();
        //check
        expect(tokenInContract).to.equal(ATM.address);
        expect(tokenPerBnbInContract).to.equal(tokenPerBnb);
        //log minBuy and maxBuy
        minBuy = await SeedRound.minBuy();
        maxBuy = await SeedRound.maxBuy();
        //console.log("minBuy: ", ethers.utils.formatEther(minBuy));
        //console.log("maxBuy: ", ethers.utils.formatEther(maxBuy));
    });
    it('set TimeStart and TimeEnd', async function () {
        await SeedRound.connect(owner).setTime(timeStart, timeEnd);
        //get timeStart
        const timeStartInContract = await SeedRound.timeStart();
        //get timeEnd
        const timeEndInContract = await SeedRound.timeEnd();
        //get isOpen
        const isOpen = await SeedRound.isOpen();
        //check timeStart
        expect(timeStartInContract).to.equal(timeStart);
        //check timeEnd
        expect(timeEndInContract).to.equal(timeEnd);
        // check isOpen
        expect(isOpen).to.equal(false);
    })
    it('try at isOpen is false', async ()=>{
        await SeedRound.connect(accounts[1]).contribute({value: ethers.utils.parseEther("1")}).then(()=>{
            expect.fail();
        }).catch(error => {
            expect(error.message).to.contains("VM Exception while processing transaction: revert");
        });
        const dataContribute = await SeedRound.getDataContribute(accounts[1].address);
        expect(dataContribute.weiRaisedContribute.eq(0));
        //amountTokens
        expect(dataContribute.amountTokens.eq(0));
        //try withdrawToken
        await SeedRound.connect(accounts[1]).withdrawToken().then(()=>{
            expect.fail();
        }).catch(error => {
            expect(error.message).to.contains("VM Exception while processing transaction: revert");
        });

        const getDataWithdraw = await SeedRound.getDataWithdraw(accounts[1].address);
        expect(getDataWithdraw.amountWithdrawNow.eq(0));
    })
    it('try at isOpen is true', async ()=>{

        await sleep(86400);
        contributes = [
            {
                account: accounts[1],
                value: minBuy.sub(1),
                result: false,
            },
            {
                account: accounts[2],
                value: minBuy,
                result: true,
            },
            {
                account: accounts[3],
                value: maxBuy,
                result: true,
            },
            {
                account: accounts[4],
                value: maxBuy.add(1),
                result: false,
            },
            {
                account: accounts[5],
                value: maxBuy,
                result: true,
            }
        ]
        for (const contribute of contributes) {
            await SeedRound.connect(contribute.account).contribute({value: contribute.value}).then(()=>{
                expect(true).to.equal(contribute.result);
            }).catch(error => {
                //console.log(contribute.value, error.message);
                expect(false).to.equal(contribute.result);
            });
            if(contribute.result){
                const dataContribute = await SeedRound.getDataContribute(contribute.account.address);
                expect(dataContribute.weiRaisedContribute.eq(contribute.value));
                //amountTokens
                expect(dataContribute.amountTokens.eq(contribute.value.mul(tokenPerBnb)));
                //console.log('amountTokens', ethers.utils.formatEther(dataContribute.amountTokens));
                //try withdrawToken
                await SeedRound.connect(contribute.account).withdrawToken().then(()=>{
                    expect.fail('should not be able to withdrawToken');
                }).catch(error => {
                    expect(error.message).to.contains("VM Exception while processing transaction: revert");
                })
                const getDataWithdraw = await SeedRound.getDataWithdraw(contribute.account.address);
                expect(getDataWithdraw.amountWithdrawNow.eq(0));
            }
        }
    })
    it('transfer token to SeedRound', async ()=>{
        const amountTokens = ethers.utils.parseEther("12000000");
        await ATM.connect(owner).transfer(SeedRound.address, amountTokens);
        const balance = await ATM.balanceOf(SeedRound.address);
        expect(balance.eq(amountTokens));
    })
    it('first withdrawToken', async ()=>{
        await sleep(86400);
        const contribute = contributes[1];
        const dataContribute = await SeedRound.getDataContribute(contribute.account.address);
        await SeedRound.connect(contribute.account).withdrawToken().then(()=>{
        }).catch(error => {
            expect.fail(error.message);
        });
        //get balance token of contribute.account
        const balance = await ATM.balanceOf(contribute.account.address);
        //check balance is 10% of AmountTokens
        expect(balance.eq(dataContribute.amountTokens.div(10)));
        //console.log('balance', ethers.utils.formatEther(balance));
        const getDataWithdraw = await SeedRound.getDataWithdraw(contribute.account.address);
        expect(getDataWithdraw.amountWithdrawNow.eq(0)).to.equal(true, "amountWithdrawNow should be 0");
        //console.log(getDataWithdraw.amountWithdrawNow);
        await SeedRound.connect(contribute.account).withdrawToken().then(()=>{
            expect.fail("should not be able to withdrawToken again");
        }).catch(error => {
            expect(error.message).to.contains("VM Exception while processing transaction: revert");
        });;
    });
    it('second withdrawToken', async ()=>{
        const successContributes = [
            {
                ...contributes[1],
                amountWithdrawNow: contributes[1].value.mul(tokenPerBnb).mul(75).div(1000), // 90%/12 = 7.5
            },{
                ...contributes[2],
                amountWithdrawNow: contributes[2].value.mul(tokenPerBnb).mul(175).div(1000), // 10% +90%/12 = 17.5
            }
        ];
        //sleep 6month
        await sleep(86400*30*6);
        for(const contribute of successContributes){
            const beforeBalance = await ATM.balanceOf(contribute.account.address);
            //getDataWithdraw
            const dataWithdraw = await SeedRound.getDataWithdraw(contribute.account.address);
            expect(dataWithdraw.amountWithdrawNow.eq(contribute.amountWithdrawNow));
            //console.log('dataWithdraw', dataWithdraw);
            await SeedRound.connect(contribute.account).withdrawToken().then(()=>{
            }).catch(error => {
                expect.fail(`${contribute.account.address}: ${error.message}`);
            });
            //get balance token of contribute.account
            const balance = await ATM.balanceOf(contribute.account.address);
            
            //check balance is 10% of AmountTokens
            //console.log('balance', ethers.utils.formatEther(balance));
            //console.log('diff', ethers.utils.formatEther(balance.sub(beforeBalance)));
            const getDataWithdraw = await SeedRound.getDataWithdraw(contribute.account.address);
            expect(getDataWithdraw.amountWithdrawNow.eq(0)).to.equal(true, "amountWithdrawNow should be 0");
            //console.log(getDataWithdraw.amountWithdrawNow);

        }
    })
    it('third withdrawToken', async ()=>{
        const contribute1 = {
            ...contributes[1],
            amountWithdrawNow: contributes[1].value.mul(tokenPerBnb).mul(75).div(1000), // 90%/12 = 7.5
        }
        //sleep 1 month
        await sleep(86400*30);
        //getDataWithdraw
        const dataWithdraw = await SeedRound.getDataWithdraw(contribute1.account.address);
        expect(dataWithdraw.amountWithdrawNow.eq(contribute1.amountWithdrawNow));
        await SeedRound.connect(contribute1.account).withdrawToken().then(()=>{
        }).catch(error => {
            expect.fail(`${contribute1.account.address}: ${error.message}`);
        });

        const contribute2 = {
            ...contributes[2],
            amountWithdrawNow: contributes[2].value.mul(tokenPerBnb).mul(150).div(1000), // 2*90%/12 = 15
        }
        //sleep 1 month
        await sleep(86400*30);
        //getDataWithdraw
        const dataWithdraw2 = await SeedRound.getDataWithdraw(contribute2.account.address);
        expect(dataWithdraw2.amountWithdrawNow.eq(contribute2.amountWithdrawNow));
        await SeedRound.connect(contribute2.account).withdrawToken().then(()=>{
        }).catch(error => {
            expect.fail(`${contribute2.account.address}: ${error.message}`);
        });
    });
    it('last withdrawToken', async ()=>{
        //current time is 8 month after end time
        //time to end round is 10 month (12-(8-6))
        await sleep(86400*30*10);
        const successContributes = [
            {
                ...contributes[1],
                amountWithdrawNow: contributes[1].value.mul(tokenPerBnb).mul(75*11).div(1000), 
            },{
                ...contributes[2],
                amountWithdrawNow: contributes[2].value.mul(tokenPerBnb).mul(75*10).div(1000), 
            }
        ];
        for(const contribute of successContributes){
            const beforeBalance = await ATM.balanceOf(contribute.account.address);
            //getDataWithdraw
            const dataWithdraw = await SeedRound.getDataWithdraw(contribute.account.address);
            expect(dataWithdraw.amountWithdrawNow.eq(contribute.amountWithdrawNow));
            //console.log('dataWithdraw', dataWithdraw);
            await SeedRound.connect(contribute.account).withdrawToken().then(()=>{
            }).catch(error => {
                expect.fail(`${contribute.account.address}: ${error.message}`);
            });
            //get balance token of contribute.account
            const balance = await ATM.balanceOf(contribute.account.address);
            
            //check balance is 10% of AmountTokens
            //console.log('balance', ethers.utils.formatEther(balance));
            //console.log('diff', ethers.utils.formatEther(balance.sub(beforeBalance)));
            const getDataWithdraw = await SeedRound.getDataWithdraw(contribute.account.address);
            expect(getDataWithdraw.amountWithdrawNow.eq(0)).to.equal(true, "amountWithdrawNow should be 0");
            //console.log(getDataWithdraw.amountWithdrawNow);
        }
    })
    it('try to withdrawToken after end round', async ()=>{
        //sleep 1 month
        sleep(86400*30);
        const contribute = {
            ...contributes[1],
            amountWithdrawNow: 0, 
        }
        //getDataWithdraw
        const dataWithdraw = await SeedRound.getDataWithdraw(contribute.account.address);
        expect(dataWithdraw.amountWithdrawNow.eq(contribute.amountWithdrawNow));
        await SeedRound.connect(contribute.account).withdrawToken().then(()=>{
            expect.fail("should not be able to withdrawToken again");
        }).catch(error => {
            expect(error.message).to.contains("VM Exception while processing transaction: revert");
        });
    })
    it('try to withdrawToken after end round [account 5]', async ()=>{
        //sleep 1 month
        sleep(86400*30);
        const contribute = {
            ...contributes[4],
            amountWithdrawNow: contributes[4].value.mul(tokenPerBnb), 
        }
        //getDataWithdraw
        const dataWithdraw = await SeedRound.getDataWithdraw(contribute.account.address);
        expect(dataWithdraw.amountWithdrawNow.eq(contribute.amountWithdrawNow));
        await SeedRound.connect(contribute.account).withdrawToken().then(()=>{
        }).catch(error => {
            expect.fail(`${contribute.account.address}: ${error.message}`);
        });
    })
});


async function sleep(seconds) {
    await network.provider.request({
        method: "evm_increaseTime",
        params: [seconds],
    }); // add 10 seconds block.timestamp;
    await network.provider.send("evm_mine", []);
}
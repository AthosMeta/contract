const BN = require('bn.js')
const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
describe("SeedRound", function () {

  let instanceToken, instanceSeedRound;
  const totalSupply = ethers.utils.parseEther("1000000");
  // const tokenPerBnb = ethers.utils.parseEther("10000");
  const tokenPerBnb = 1000;
  const timeStart = Math.floor(Date.now() / 1000) + 86400;
  // set timeEnd to 2 days from now
  const timeEnd = Math.floor(Date.now() / 1000) + 172800;

  let addrs;

  it("deploys", async function () {
    addrs = await ethers.getSigners();
    const DemoToken = await ethers.getContractFactory("Token");
    const SeedRound = await ethers.getContractFactory("SeedRound");
    console.log("Deploying SeedRound now, please wait ...");
    // instanceFactory = await SeedRound.deployed();
    instanceToken = await DemoToken.deploy("Token", "TKN");
    instanceSeedRound = await SeedRound.deploy(instanceToken.address, tokenPerBnb);
    await instanceToken.transfer(instanceSeedRound.address, ethers.utils.parseEther("500000"))
  });

  it("check Owner the Seed", async function () {
    const accounts = await ethers.getSigners();
    const owner = await instanceSeedRound.owner();
    console.log("owner: ", owner);
    expect(owner).to.equal(accounts[0].address);
    // assert.equal(owner, accounts[0], "Owner is not the first account");
  })

  it("set time seed ", async function () {
    await instanceSeedRound.setTime(timeStart, timeEnd);
  });

  it("check time open false", async function () {
    const checkOpen = await instanceSeedRound.isOpen();
    // assert.equal(checkOpen, false);
    expect(checkOpen).to.equal(false);
  })

  it("check time open true", async function () {
    // set time 
    await instanceSeedRound.setTime(timeStart - 86400 * 2, timeEnd);

    const checkOpen = await instanceSeedRound.isOpen();
    // assert.equal(checkOpen, false);
    expect(checkOpen).to.equal(true);
  })

  it('contribute less min buy', async () => {
    // await sleep(6000);
    const [owner, addr1] = await ethers.getSigners();
    const amount = ethers.utils.parseEther("0.0001");
    try {
      await instanceSeedRound.connect(addr1).contribute({ value: amount });
      throw "error";
    } catch (e) {
      if (!e.message.includes("SEEDROUND:MINIMUM")) throw new Error(e.message)
    }

  });

  it('contribute less max buy', async () => {
    const [owner, addr1] = await ethers.getSigners();
    const amount = ethers.utils.parseEther("5");
    try {
      await instanceSeedRound.connect(addr1).contribute({ value: amount });
      throw "error";
    } catch (e) {
      if (!e.message.includes("SEEDROUND:MAXINUM")) throw new Error(e.message)
    }
  });

  it('contribute ', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const amount = ethers.utils.parseEther("1");
    const amount2 = ethers.utils.parseEther("2");
    await instanceSeedRound.connect(addr1).contribute({ value: amount });
    await instanceSeedRound.connect(addr2).contribute({ value: amount2 });
    await instanceSeedRound.connect(addrs[3]).contribute({ value: amount });
  });

  it('get data contribute', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const [weiRaisedContribute, amountTokens] = await instanceSeedRound.getDataContribute(addr2.address);
    console.log('amountTokens', amountTokens);
    expect(weiRaisedContribute.toString()).to.equal(ethers.utils.parseEther("2"))
    expect(amountTokens.toString()).to.equal(ethers.utils.parseEther(tokenPerBnb * 2 + ""))
  })


  it('get data withdraw when no finish', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const [amountWithdrawNow, _data] = await instanceSeedRound.getDataWithdraw(addr2.address);
    console.log('amountTokens', amountWithdrawNow);
    expect(amountWithdrawNow.toString()).to.equal(ethers.utils.parseEther("0"))
    // expect(amountTokens.toString()).to.equal(ethers.utils.parseEther(tokenPerBnb * 2 + ""))
  })

  it('get data withdraw when finish', async () => {
    await instanceSeedRound.setTime(Math.floor(Date.now() / 1000) - 100000, Math.floor(Date.now() / 1000) - 1000);
    const [owner, addr1, addr2] = await ethers.getSigners();
    const [amountWithdrawNow1, _data1] = await instanceSeedRound.getDataWithdraw(addr1.address);
    const [amountWithdrawNow2, _data2] = await instanceSeedRound.getDataWithdraw(addr2.address);
    expect(amountWithdrawNow1.toString()).to.equal(ethers.utils.parseEther("100"))
    expect(amountWithdrawNow2.toString()).to.equal(ethers.utils.parseEther("200"))
    // expect(amountTokens.toString()).to.equal(ethers.utils.parseEther(tokenPerBnb * 2 + ""))
  })

  it('addr1 withdraw when finish', async () => {
    await instanceSeedRound.connect(addrs[1]).claim();
    const balance = await instanceToken.balanceOf(addrs[1].address);
    expect(balance.toString()).to.equal(ethers.utils.parseEther("100"))
  })

  it('addr1 withdraw invalid', async () => {

    try {
      await instanceSeedRound.connect(addrs[1]).claim();
    } catch (e) {
      // SEEDROUND:invalid
      if (!e.message.includes("SEEDROUND:invalid")) throw new Error(e.message)
    }
  })


  it('addr1 get data withdraw', async () => {
    const [amountWithdrawNow1, _data1] = await instanceSeedRound.getDataWithdraw(addrs[1].address);
    expect(_data1.isFirstWithdrawed).to.equal(true);
  })

  it('addr1 get data withdraw finish 8 moth', async () => {
    await setTimeAfterMoth(8);
    const [amountWithdrawNow1, _data1] = await instanceSeedRound.getDataWithdraw(addrs[1].address);
    expect(amountWithdrawNow1.toString()).to.equal(ethers.utils.parseEther("150"))
  })

  it('get data withdraw address 2 when finish 8 moth', async () => {
    const [amountWithdrawNow, _data] = await instanceSeedRound.getDataWithdraw(addrs[2].address);
    expect(amountWithdrawNow.toString()).to.equal(ethers.utils.parseEther("500"))
  })

  it('addr1, addr2 withdraw when finish after 8 moth', async () => {
    await instanceSeedRound.connect(addrs[1]).claim();
    await instanceSeedRound.connect(addrs[2]).claim();
    const balance = await instanceToken.balanceOf(addrs[2].address);
    expect(balance.toString()).to.equal(ethers.utils.parseEther("500"))
  })

  it('get data withdraw when finish  after 8 moth', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const [amountWithdrawNow1, _data1] = await instanceSeedRound.getDataWithdraw(addr1.address);
    const [amountWithdrawNow2, _data2] = await instanceSeedRound.getDataWithdraw(addr2.address);
    expect(_data1.countWithdrawed.toString()).to.equal("2");
    expect(_data2.countWithdrawed.toString()).to.equal("2");
  })


  it('withdraw when finish after 20 moth', async () => {
    await setTimeAfterMoth(20);
    await instanceSeedRound.connect(addrs[1]).claim();
    await instanceSeedRound.connect(addrs[2]).claim();
    await instanceSeedRound.connect(addrs[3]).claim();
    const balance1 = await instanceToken.balanceOf(addrs[1].address);
    const balance2 = await instanceToken.balanceOf(addrs[2].address);
    const balance3 = await instanceToken.balanceOf(addrs[3].address);
    expect(balance1.toString()).to.equal(ethers.utils.parseEther("1000"))
    expect(balance2.toString()).to.equal(ethers.utils.parseEther("2000"))
    expect(balance3.toString()).to.equal(ethers.utils.parseEther("1000"))
  })


  it('get data withdraw when finish  after 20 moth', async () => {
    const [amountWithdrawNow1, _data1] = await instanceSeedRound.getDataWithdraw(addrs[1].address);
    const [amountWithdrawNow2, _data2] = await instanceSeedRound.getDataWithdraw(addrs[2].address);
    const [amountWithdrawNow3, _data3] = await instanceSeedRound.getDataWithdraw(addrs[3].address);
    expect(_data1.countWithdrawed.toString()).to.equal("12");
    expect(_data2.countWithdrawed.toString()).to.equal("12");
    expect(_data3.countWithdrawed.toString()).to.equal("12");
  })

  async function setTimeAfterMoth(moth = 7) {
    await instanceSeedRound.setTime(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * moth * 30 - 2000, Math.floor(Date.now() / 1000) - 60 * 60 * 24 * moth * 30);
  }
});

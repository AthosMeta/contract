const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
const assert = require("assert");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
describe("WhiteList", function () {

  let instanceToken, instanceSeedRound, accounts;
  const totalSupply = ethers.utils.parseEther("1000000");
  const tokenPerBnb = ethers.utils.parseEther("10000");
  const timeStart = Math.floor(Date.now() / 1000) + 86400;
  // set timeEnd to 2 days from now
  const timeEnd = Math.floor(Date.now() / 1000) + 172800;

  console.log("timeStart: ", timeStart);
  it("deploys", async function () {
    accounts = (await ethers.getSigners()).map(s => s.address);
    const DemoToken = await ethers.getContractFactory("DemoToken");
    const SeedRound = await ethers.getContractFactory("SeedRound");
    console.log("Deploying SeedRound now, please wait ...");
    // instanceFactory = await SeedRound.deployed();
    instanceToken = await DemoToken.deploy("Athos Meta","ATM",ethers.utils.parseEther("1000000"));
    instanceSeedRound = await SeedRound.deploy(instanceToken.address, tokenPerBnb);
    await instanceSeedRound.setWhiteList(true, 600);
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


  it("check time open true", async function () {
    // set time 
    await instanceSeedRound.setTime(Math.floor(Date.now() / 1000) - 200, timeEnd);

    const checkOpen = await instanceSeedRound.isOpen();
    // assert.equal(checkOpen, false);
    expect(checkOpen).to.equal(true);
  })

  it("add whitelist", async function () {
    const addresses = [
      accounts[0],
      accounts[1],
      accounts[2],
      accounts[3],
    ]
    await instanceSeedRound.addToWhitelist(addresses);
    const whiteList = await instanceSeedRound.getWhitelist();
    assert.equal(whiteList.length, addresses.length, "whitelist length is not correct");
  })
  it("check whitelist accounts[0]", async function () {
    const isWhiteList = await instanceSeedRound.isAddressInWhiteList(accounts[0]);
    assert.equal(isWhiteList, true, "accounts[0] is not in whitelist");
  });

  it("remove accounts[3] in WhiteList", async () => {
    await instanceSeedRound.removeFromWhitelist([accounts[3]]);
    const isWhiteList = await instanceSeedRound.isAddressInWhiteList(accounts[3]);
    assert.equal(isWhiteList, false, "accounts[3] is in whitelist");
    const whiteList = await instanceSeedRound.getWhitelist();
    assert.equal(whiteList.length, 3, "whitelist length is not correct");
  })

  it("remove account 1 and 2 in WhiteList", async () => {
    await instanceSeedRound.removeFromWhitelist([accounts[1], accounts[2]]);
    const isWhiteList = await instanceSeedRound.isAddressInWhiteList(accounts[1]);
    assert.equal(isWhiteList, false, "accounts[1] is in whitelist");
    const whiteList = await instanceSeedRound.getWhitelist();
    assert.equal(whiteList.length, 1, "whitelist length is not correct");
  })

  it('contribute not in WhiteList', async () => {
    const addresses = [
      accounts[4],
      accounts[5]
    ]
    await instanceSeedRound.addToWhitelist(addresses);
    const amount = ethers.utils.parseEther("1");
    const amount2 = ethers.utils.parseEther("2");
    const acc = await ethers.getSigners();
    try {
      await instanceSeedRound.connect(acc[2]).contribute({ value: amount });
      await instanceSeedRound.connect(acc[3]).contribute({ value: amount2 });
    } catch (e) {
      if (!e.message.includes("SEEDROUND: IS_NOT_WHITELISTED")) throw new Error(e.message)
    }

  });

  it('contribute has in WhiteList', async () => {
    const addresses = [
      accounts[4],
      accounts[5]
    ]
    await instanceSeedRound.addToWhitelist(addresses);
    const amount = ethers.utils.parseEther("1");
    const amount2 = ethers.utils.parseEther("2");
    const acc = await ethers.getSigners();
    await instanceSeedRound.connect(acc[4]).contribute({ value: amount });
    await instanceSeedRound.connect(acc[5]).contribute({ value: amount2 });
  });


});

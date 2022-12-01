const { ethers, network, waffle } = require("hardhat");
const provider = waffle.provider;
const createFixtureLoader = waffle.createFixtureLoader;
const { v2Fixture } = require("./fixtures/uniswap.js");
const BigNumber = ethers.BigNumber;
const baseConfig = {
  denominator: 10000,
  period: 86400, // 86400 seconds in a day
  totalPeriods: 365, // 365 days
  feeEarlyWithdraw: 1000, // 10% fee early withdraw
};
const tokens = {
  testnet: {
    ATM: '0x10e1acd4E340141C7aDd7288053dCc73f662F16E',
    BUSD: '0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7',
    WETH: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd'
  },
  mainnet:{
    ATM: '0x957B5Ab206D4B1D2E3819e444088861D5E2E0613',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    WETH: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
  }
}
const config = {
  testnet: {
    deployArgs: {
      WETH: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    },
    rates: [
      {
        token: tokens.testnet.ATM, //ATM
        APR: 10000, // 100% APR
        period: 182,
        withdrawFee: 0,
      },
      {
        token: tokens.testnet.ATM, //ATM
        APR: 12000, // 120% APR
        period: 365,
        withdrawFee: 0,
      },
      {
        token: tokens.testnet.BUSD, //BUSD
        APR: 5000, // 50% APR
        period: 182,
        withdrawFee: 300, // 3% of profit
      },
      {
        token: tokens.testnet.BUSD, //BUSD
        APR: 6000, // 60% APR
        period: 365,
        withdrawFee: 300,
      },
      {
        token: tokens.testnet.WETH, //WETH
        APR: 5000, // 50% APR
        period: 182,
        withdrawFee: 300, // 3% of profit
      },
      {
        token: tokens.testnet.WETH, //WETH
        APR: 6000, // 60% APR
        period: 365,
        withdrawFee: 300,
      },
    ],
    depositArr: [
      {
        token: tokens.testnet.ATM,
        amount: ethers.utils.parseEther("100000"),
        isWrapped: false,
      },
      {
        token: tokens.testnet.BUSD,
        amount: ethers.utils.parseEther("1"),
        isWrapped: false,
      },
      {
        token: tokens.testnet.WETH,
        amount: ethers.utils.parseEther("0.01"),
        isWrapped: true,
      }
    ]
  },
  mainnet: {
    deployArgs: {
      WETH: tokens.mainnet.WETH,
    },
    rates: [
      {
        token: tokens.mainnet.ATM, //ATM
        APR: 30000, // 100% APR
        period: 182,
        withdrawFee: 0,
      },
      {
        token: tokens.mainnet.ATM, //ATM
        APR: 20400, // 120% APR
        period: 365,
        withdrawFee: 0,
      },
      {
        token: tokens.mainnet.BUSD, //BUSD
        APR: 18000, // 50% APR
        period: 182,
        withdrawFee: 300, // 3% of profit
      },
      {
        token: tokens.mainnet.BUSD, //BUSD
        APR: 24000, // 60% APR
        period: 365,
        withdrawFee: 300,
      },
      {
        token: tokens.mainnet.WETH, //WETH
        APR: 18000, // 50% APR
        period: 182,
        withdrawFee: 300, // 3% of profit
      },
      {
        token: tokens.mainnet.WETH, //WETH
        APR: 24000, // 60% APR
        period: 365,
        withdrawFee: 300,
      },
    ],
    depositArr: [
      
    ]
  },
};
async function main() {
  let constructParams, rates, owner, depositArr;
  const DemoToken = await ethers.getContractFactory("DemoToken");
  if (network.name in config) {
    constructParams = { ...config[network.name].deployArgs, ...baseConfig };
    rates = config[network.name].rates;
    depositArr = config[network.name].depositArr;
    //change address to contract
    for(let i = 0; i < depositArr.length; i++){
      depositArr[i].token = DemoToken.attach(depositArr[i].token);
    }

  } else {
    [owner] = await ethers.getSigners();
    const loadFixture = createFixtureLoader([owner], provider);
    UniswapV2 = await loadFixture(v2Fixture);
    
    const ATM = await await DemoToken.deploy(
      "Athos Meta",
      "ATM",
      ethers.utils.parseEther("10000000000")
    );
    const BUSD = await DemoToken.deploy(
      "BUSD",
      "BUSD",
      ethers.utils.parseEther("10000000000")
    );
    const WETH = UniswapV2.WETH;
    console.log("WETH address: ", WETH.address);
    console.log("ATM address: ", ATM.address);
    console.log("BUSD address: ", BUSD.address);
    constructParams = {
      WETH: WETH.address,
      ...baseConfig,
    };
    rates = [
      {
        token: ATM.address,
        APR: 10000, // 100% APR
        period: 182,
        withdrawFee: 0,
      },
      {
        token: ATM.address,
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
        token: WETH.address,
        APR: 5000, // 50% APR
        period: 182,
        withdrawFee: 300, // 3% of profit
      },
      {
        token: WETH.address,
        APR: 6000, // 60% APR
        period: 365,
        withdrawFee: 300,
      },
    ];
    depositArr = [
      {
        token: ATM,
        amount: ethers.utils.parseEther("1000000000"),
        isWrapped: false,
      },
      {
        token: BUSD,
        amount: ethers.utils.parseEther("1000000000"),
        isWrapped: false,
      },
      {
        token: WETH,
        amount: ethers.utils.parseEther("100"),
        isWrapped: true,
      },
    ];
  }
  const Stake = await ethers.getContractFactory("Stake");
  const StakeInstance = await Stake.deploy(...Object.values(constructParams));
  await StakeInstance.deployed();
  console.log("Stake contract deployed at: ", StakeInstance.address);
  for (let i = 0; i < rates.length; i++) {
    await StakeInstance.setRate(
      rates[i].token,
      rates[i].APR,
      rates[i].period,
      rates[i].withdrawFee
    );
    console.log("Rate set for token: ", rates[i].token);
  }
  for (let i = 0; i < depositArr.length; i++) {
    let deposit = depositArr[i];
    if (deposit.isWrapped) {
      await StakeInstance.depositEth({ value: deposit.amount });
      console.log(
        "DEPOSIT TOKEN:",
        deposit.token.address,
        "AMOUNT:",
        ethers.utils.formatEther(deposit.amount)
      );
    } else {
      await deposit.token.transfer(StakeInstance.address, deposit.amount);
      console.log(
        "DEPOSIT TOKEN:",
        deposit.token.address,
        "AMOUNT:",
        ethers.utils.formatEther(deposit.amount)
      );
    }
    //check balance after deposit
    let balance = await deposit.token.balanceOf(StakeInstance.address);
    console.log("BALANCE:", ethers.utils.formatEther(balance));
  }
  //verify contract
  if(network.name === "testnet" || network.name === "mainnet"){
    await StakeInstance.deployTransaction.wait(6); // wait 6 block to make sure the contract is deployed
    await hre.run("verify:verify", {
      address: StakeInstance.address,
      constructorArguments: [...Object.values(constructParams)],
    });
    console.log("Contract verified");
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

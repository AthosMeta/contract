const { ethers, network, waffle } = require("hardhat");
const config = {
  testnet: [
    '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee' // BUSD
  ],
  mainnet: [
    '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
    '0x957B5Ab206D4B1D2E3819e444088861D5E2E0613', //ATM
  ],
  hardhat: [
    '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee' // BUSD
  ]
}
async function main() {
  const PaymentGateway = await ethers.getContractFactory("PaymentGateway");
  const PaymentGatewayInstance = await PaymentGateway.deploy();
  await PaymentGatewayInstance.deployed();
  console.log("PaymentGateway deployed to:", PaymentGatewayInstance.address);

  //setAcceptableToken
  for (let i = 0; i < config[network.name].length; i++) {
    await PaymentGatewayInstance.setAcceptableToken(config[network.name][i]);
    console.log('setAcceptableToken OK');
  }
  if(network.name === "testnet" || network.name === "mainnet"){
    await hre.run("verify:verify", {
      address: PaymentGatewayInstance.address,
      constructorArguments: [],
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

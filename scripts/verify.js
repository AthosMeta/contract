const { ethers, network, waffle } = require("hardhat");

async function main(){
    const constructParams = {
        name: "Athos Meta",
        symbol: "ATM",
    }
    if(network.name === "testnet" || network.name === "mainnet"){
        await hre.run("verify:verify", {
            address: '0x06DE21579090960Cab85F64Bf133e9A3234bab95',
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

const { ethers, network, waffle } = require("hardhat");
const config = {
    testnet: {
        deployArgs: ['0x58888B5E44Cc46380e95862726a4aa7a8a9ecFE3', 75000],
        time: [1664582400, 1667260800]
    },
    mainnet: {
        deployArgs: ['0xF02b31b0B6dCabd579e41A0250288608FA43F898', 75000],
        time: [1664582400, 1667260800]
    },
    hardhat: {
        deployArgs: ['0x58888B5E44Cc46380e95862726a4aa7a8a9ecFE3', 75000],
        time: [1664582400, 1667260800]
    },
}

async function main() {
    const PrivateRoundContract = await ethers.getContractFactory("PrivateRound");
    const PrivateRoundInstance = await PrivateRoundContract.deploy(...config[network.name].deployArgs);
    await PrivateRoundInstance.deployed();
    console.log("PrivateRound deployed to:", PrivateRoundInstance.address);
    await PrivateRoundInstance.setTime(...config[network.name].time);
    console.log('setTime OK');
    //verify contract
    if (network.name === "testnet" || network.name === "mainnet") {
        try{    
            await PrivateRoundInstance.deployTransaction.wait(6); // wait 6 block to make sure the contract is deployed
            await hre.run("verify:verify", {
                address: PrivateRoundInstance.address,
                constructorArguments: [...config[network.name].deployArgs],
            });
            console.log("Contract verified");

        }catch(e){
            console.log("verify contract failed", e);
        }
        
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

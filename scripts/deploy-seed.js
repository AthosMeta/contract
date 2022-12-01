const { ethers, network, waffle } = require("hardhat");
const config = {
    testnet: {
        deployArgs: ['0x58888B5E44Cc46380e95862726a4aa7a8a9ecFE3', 150000],
        time: [1661515200, 1661860800]
    },
    mainnet: {
        deployArgs: ['0xF02b31b0B6dCabd579e41A0250288608FA43F898', 150000],
        time: [1662033600, 1664539200]
    },
    hardhat: {
        deployArgs: ['0x58888B5E44Cc46380e95862726a4aa7a8a9ecFE3', 150000],
        time: [1661097600, 1661184000]
    },
}
const contributes = [
    {
        contributor: '0x3a51cab1302a9BdAA8df5e91B8bFeeE082b45e7B',
        amount: '10000000000000000000'
    },
    {
        contributor: '0x3a51cab1302a9BdAA8df5e91B8bFeeE082b45e7B',
        amount: '15000000000000000000'
    },
    {
        contributor: '0x3a51cab1302a9BdAA8df5e91B8bFeeE082b45e7B',
        amount: '12000000000000000000'
    },
    {
        contributor: '0x03B3E750a1c2F456f18e771F2e4d7a9dEA7D55AC',
        amount: '10000000000000000000'
    },
    {
        contributor: '0x20E3670d085525Bc27abfA50C53611B50223fD19',
        amount: '14300000000000000000'
    },
    {
        contributor: '0x6cD91050Eaa09cCc905cacD49484a4dfFf9e039c',
        amount: '10000000000000000000'
    },
    {
        contributor: '0x6e36032E27B7E1195b48467Dc3FDc4Ca9C68D92f',
        amount: '10164354755626813050'
    },
    {
        contributor: '0x03B3E750a1c2F456f18e771F2e4d7a9dEA7D55AC',
        amount: '10000000000000000000'
    },
    {
        contributor: '0x9aECef7E3504Af27cC1dA4a49FeBa0056f660E45',
        amount: '13000000000000000000'
    },
    {
        contributor: '0x03B3E750a1c2F456f18e771F2e4d7a9dEA7D55AC',
        amount: '10000000000000000000'
    },
    {
        contributor: '0xa7789BB172d0413d9726Da7CC2F3447a7A3C3678',
        amount: '25000000000000000000'
    },
    {
        contributor: '0x4DE05bF7E0f55Cf84261B14d13741051C7ddb109',
        amount: '10000000000000000000'
    },
    {
        contributor: '0xb90737Fd6178665724701E035B0bAf77b1A0B3B4',
        amount: '17000000000000000000'
    },
    {
        contributor: '0xb90737Fd6178665724701E035B0bAf77b1A0B3B4',
        amount: '12000000000000000000'
    },
    {
        contributor: '0xdE43f96CF22Ddb274908128836f461Ac3D7b087a',
        amount: '10400000000000000000'
    },
    {
        contributor: '0x8198bC8643251DE714182101Bdf078D65F39e6ea',
        amount: '11000000000000000000'
    }
];
async function main() {
    const SeedRoundContract = await ethers.getContractFactory("SeedRound");
    const SeedRoundInstance = await SeedRoundContract.deploy(...config[network.name].deployArgs);
    await SeedRoundInstance.deployed();
    console.log("SeedRound deployed to:", SeedRoundInstance.address);
    await SeedRoundInstance.setTime(...config[network.name].time);
    console.log('setTime OK');
    //verify contract
    if (network.name === "testnet" || network.name === "mainnet") {
        try{    
            await SeedRoundInstance.deployTransaction.wait(6); // wait 6 block to make sure the contract is deployed
            await hre.run("verify:verify", {
                address: SeedRoundInstance.address,
                constructorArguments: [...config[network.name].deployArgs],
            });
            console.log("Contract verified");

        }catch(e){
            console.log("verify contract failed", e);
        }
        
    }
    //set contribute
    if(network.name === "testnet" || network.name === "mainnet") {
        for (let i = 0; i < contributes.length; i++) {
            try{
                const contribute = contributes[i];
                await SeedRoundInstance.setContribute(contribute.contributor, contribute.amount);
                console.log(`contribute ${contribute.contributor} with ${ethers.utils.formatEther(contribute.amount)} OK`);
            }catch(e){
                console.log(`contribute ${contribute.contributor} with ${contribute.amount} FAILED`);
            }
        }
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

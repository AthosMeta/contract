const { ethers, network, waffle } = require("hardhat");
const provider = waffle.provider;
const config = {
    testnet: {
        router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
    },
    mainnet: {
        router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    },
    hardhat: {
        router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1'
    }
}
async function main(){
    if(network.name in config){
        const [owner] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("Token");
        //deploy token
        const constructParams = {
            name: "Athos Meta",
            symbol: "ATM",
            router: config[network.name].router,
        }
        const ATM = await Token.deploy(...Object.values(constructParams));
        await ATM.deployed();
        console.log("ATM address: ", ATM.address);

        //await ATM.setRouteCheckFee(config[network.name].router);
        //set route check fee OK
        //console.log('setRoute check fee OK');
        //const check = await ATM.isRouteCheckFee(config[network.name].router);
        //console.log('check: ', check);
        //log token balance of owner
        const balanceATM = await ATM.balanceOf(owner.address);
        const totalSupply = await ATM.totalSupply();
        const name = await ATM.name();
        const symbol = await ATM.symbol();
        const decimal = await ATM.decimals();
        //log
        console.log("ATM balance: ", ethers.utils.formatEther(balanceATM));
        console.log("ATM totalSupply: ", ethers.utils.formatEther(totalSupply));
        console.log("ATM name: ", name);
        console.log("ATM symbol: ", symbol);
        console.log("ATM decimal: ", decimal);
        if(network.name === "testnet" || network.name === "mainnet"){
            await ATM.deployTransaction.wait(6); // wait 6 block to make sure the contract is deployed
            await hre.run("verify:verify", {
                address: ATM.address,
                constructorArguments: [...Object.values(constructParams)],
            });
            console.log("Contract verified");
        }
    }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

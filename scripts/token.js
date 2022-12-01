const hre = require("hardhat");
async function main() {
  const DemoToken = await hre.ethers.getContractFactory("DemoToken");
    const token = await DemoToken.deploy("Athos Meta", "ATM", hre.ethers.utils.parseEther("600000000"));
    await token.deployed();
    console.log("token address: ", token.address);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

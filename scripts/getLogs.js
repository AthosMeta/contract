const { ethers, network, waffle } = require("hardhat");
const axios = require('axios').default;

async function main() {
    const SeedRoundContract = await ethers.getContractFactory("SeedRound");
    const SeedRound = await SeedRoundContract.attach("0xda66CE5DeEBFf990839Ac2329f8FC56f19f31d4c");
    const filter = SeedRound.filters.Contribute();
    console.log(filter);
    const api = `https://api.bscscan.com/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${filter.address}&topic0=${filter.topics[0]}&apikey=YourApiKeyToken`;
    const response = await axios.get(api);
    //console.log(response.data);
    const listLogs = response.data.result;
    const listContributor = [];
    for(let i = 0; i < listLogs.length; i++){
        const parseLog = SeedRound.interface.parseLog(listLogs[i]);
        const contributor = parseLog.args.owner;
        const amount = ethers.utils.formatEther(parseLog.args.amount.toString())
        const contributorInfo = {
            contributor,
            amount
        };
        listContributor.push(contributorInfo);
        
    }
    console.log(listContributor);
    
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

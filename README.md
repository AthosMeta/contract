# Basic Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
node scripts/sample-script.js
npx hardhat help
```

## Stake

- Test: `npx hardhat test test/stake.js`
- Deploy: `npx hardhat run scripts/deploy-stake.js`

### Deploy for localhost using metamask

- create Localhost node: `npx hardhat node`
- import `account[0]` to metamask and using network `localhost 8545`
- deploy stake : `npx hardhat run scripts/deploy-stake.js --network localhost`
- add token to metamask: ATM address, BUSD address

## Farm

### Deploy for localhost using metamask

- create Localhost node: `npx hardhat node`
- import `account[0]` to metamask and using network `localhost 8545`
- deploy stake : `npx hardhat run scripts/deploy-farm.js --network localhost`
- add token to metamask: ATM address, BUSD address


## Deployed

### Testnet
- Farm: `0x8b6bC6d2E4D7ac5e770D3B3B718fbe53b9c0Ae98`
- ATM: `0x10e1acd4E340141C7aDd7288053dCc73f662F16E`
- BUSD: `0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7`
- WETH: `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd`

### Mainnet
- ATM: `0x957B5Ab206D4B1D2E3819e444088861D5E2E0613`
- Payment Gateway: `0x06DE21579090960Cab85F64Bf133e9A3234bab95`
- Stake: `0x3Cc87362154D65bCa06c8Fdf33920d0A988D7881`
- BUSD: `0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56`
- WETH: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`
- PancakeRoute: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
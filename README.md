# staking-contract
Staking contract for multiple tokens

## About
* It's a Staking contract for multiple tokens.
* User gets rewards based on the current staking amount, reward interval, token's reward rate, staked time duration. 
* [Instruction](./instruction.md)
 
## Installation
```console
$ npm i
```

## Usage

### Build
```console
$ npx hardhat compile
```

### Test
```console
$ npx hardhat test
```

### Deploying contracts to localhost Hardhat EVM
#### localhost
```console
// on terminal-1
$ npx hardhat node

// on terminal-2
$ npx hardhat run deployment/hardhat/deploy.ts --network localhost
```


### Deploying contracts to Testnet (Public)
#### ETH Testnet - Rinkeby
* Environment variables
  - Create a `.env` file with its values:
```
INFURA_API_KEY=[YOUR_INFURA_API_KEY_HERE]
DEPLOYER_PRIVATE_KEY=[YOUR_DEPLOYER_PRIVATE_KEY_without_0x]
REPORT_GAS=<true_or_false>
```

* Deploy the contracts
```console
$ npx hardhat run deployment/testnet/rinkeby/deploy.ts  --network rinkeby
```

### Deploying contracts to Mainnet
#### ETH Mainnet
* Environment variables
  - Create a `.env` file with its values:
```
INFURA_API_KEY=[YOUR_INFURA_API_KEY_HERE]
DEPLOYER_PRIVATE_KEY=[YOUR_DEPLOYER_PRIVATE_KEY_without_0x]
REPORT_GAS=<true_or_false>
```

* Deploy the token on one-chain
```console
$ npx hardhat run deployment/testnet/ETH/deploy.ts  --network mainnet
```

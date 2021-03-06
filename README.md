# multistaking-contract

Staking contract with unstaking feature along with reward distribution for different ERC20 tokens

## About

* It's a Staking contract for multiple tokens.
* User gets rewards based on the current staking amount, reward interval, token's reward rate, staked time duration.
* [Instruction](./instruction.md)

* **CONS**:
  * Currently, if a person stakes x at t = t1, y at t = t1+1, then total staked is taken as (x + y). And this is wrong because the time difference for staking is not taken into consideration. So, ideally a person can stake all at once at the end of year & then gain the rewards based on the entire staked amount (which actually got added on 12th month & the 1st staking happened at 1st month). So, this is absolutely wrong calculation. The solution is to create this data structure:

NOW:

```c
    struct Record {
        uint256 stakedAmount;
        uint256 stakedAt;
        uint256 unstakedAmount;
        uint256 unstakedAt;
        uint256 rewardAmount;
    }

    //implement your code here for "records", a mapping of token addresses and 
    // user addresses to an user Record struct
    mapping(address => mapping(address => Record)) public records;
```

UPDATED to:

```c
    struct Record {
        uint256 stakedAmount;
        uint256 unstakedAmount;
        uint256 unstakedAt;
        uint256 rewardAmount;
    }

    //implement your code here for "records", a mapping of token addresses and 
    // user addresses to an user Record struct
    // mapping (token => user => stakedAt => Record)
    mapping(address => mapping(address => mapping (uint256 => Record))) public records;
```

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
$ npx hardhat run deployment/mainnet/ETH/deploy.ts  --network mainnet
```

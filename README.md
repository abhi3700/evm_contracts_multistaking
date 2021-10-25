<p align="center">
  <h1 align="center">
  Master Ventures
  </h1>
</p>

<p align="center">
  <b>
  Smart Contract - Take Home Test
  </b><br>
</p>

Welcome Candidate and thank you for taking the time to complete the Master Ventures take-home test for our senior smart contract engineer position.

You will have **2 days** to complete the assignment. Once you have completed your solution, please reply with a link to a github repository, the README.md file should contain instructions on how to install, run, and test the contract.

## Goal of the contract
Implement a Staking contract that will block the staked tokens for a period of time.
The address of the ERC20 token must be set at deployment.

## Instructions

> Implement the env.template variables in a .env file.

```
INFURA_ID=
BURN_ADDRESS=0x000000000000000000000000000000000000dEaD
DEPLOYER_PRIVATE_KEY=
```

> Node environment

- Use node LTS version
- Include an .nvmrc file

> Running tests with an ERC20 Token
- Use a openzeppelin as a base for a simple token, in oreder to run the unit test.
- Make the deployment account for the token different from the contract deployment account.

> Toolset
- Use [hardhat](https://hardhat.org/) to build / test the contract.
- Use typescript, ethers.js
- Use waffle for tests.

> Deliverables
- implement code for contract outline below
- Make the following functions to accept amount == 0: stake(), unstake(), withdrawUnstaked(), withdrawReward(), calculateReward(); If amount is zero, then the smart contract should adjust the amount value to be the maximum available value. For example, if _amount is zero for stake() function, then the smart contract should use maximum available value for _amount, which is the caller's token balance.
- Make this in your own git repository and give us the public access to clone it.
- Make a README.md file with instructions on how to clone, install, and run your Hardhat tests.
- Include a deployment script.

---
## Exam: Simple Staking contract and its Hardhat tests

```//SPDX-License-Identifier: MIT

pragma solidity ^0.8.5;

//import ERC20Upgradeable, etc... here

//import hardhat console log feature here

//make standard ERC20 tokens below and deploy this twice as staked token and reward token
contract ERC20 is OwnableUpgradeable, ERC20Upgradeable,ERC20BurnableUpgradeable {
  function initialize() public initializer {
    //implement your code here
  }

  function mint(address user, uint256 amount)
    public onlyOwner returns (bool) {
    //implement your code here
  }
}


//------------------------------==
//------------------------------==
contract SimpleStaking is Initializable, OwnableUpgradeable, PausableUpgradeable {
  //implement your code here to use SafeERC20Upgradeable and AddressUpgradeable

  address public rwTokenAddr;//reward token address
  uint256 public rewardInterval;
  
  struct Record {
    uint256 stakedAmount;
    uint256 stakedAt;
    uint256 unstakedAmount;
    uint256 unstakedAt;
    uint256 rewardAmount;
  }

  //implement your code here for "records", a mapping of token addresses and user addresses to an user Record struct

  //implement your code here for "rewardRates", a mapping of token address to reward rates. e.g. if APY is 20%, then rewardRate is 20.

  event Stake(address indexed user, uint256 amount, uint256 stakedAt);
  event Unstake(address indexed user, uint256 amount, address indexed tokenAddr, uint256 reward, uint256 unstakedAt);
  event WithdrawUnstaked(address indexed user, uint256 amount, uint256 withdrawAt);
  event WithdrawRewards(address indexed user, uint256 amount, uint256 withdrawAt);
  event SetRewardRate(address indexed tokenAddr, uint256 newRewardRate);
  
  function initialize(address _rwTokenAddr) external initializer {
    //implement your code here
  }

  // for users to stake tokens
  function stake(address tokenAddr, uint256 amount) external whenNotPaused {
    //implement your code here
  }

  //for users to unstake their staked tokens
  function unstake(address tokenAddr, uint256 amount)
  external whenNotPaused {
    //implement your code here
  }

  //for users to withdraw their unstaked tokens from this contract to the caller's address
  function withdrawUnstaked(address tokenAddr, uint256 _amount) external whenNotPaused {
    //implement your code here
  }

  //for users to withdraw reward tokens from this contract to the caller's address
  function withdrawReward(address tokenAddr, uint256 _amount) external whenNotPaused {
    //implement your code here
  }

  //to calculate rewards based on the duration of staked tokens, staked token amount, reward rate of the staked token, reward interval
  function calculateReward(address tokenAddr, address user, uint256 _amount) public view returns (uint256) {
    //implement your code here
  }

  //only for this contract owner to set the reward rate of a staked token
  function setRewardRate(address tokenAddr, uint256 rewardRate) external onlyOwner {
    //implement your code here
  }

  //only for this contract owner to pause this contract
  function pause() external onlyOwner whenNotPaused {
    //implement your code here
  }

  //only for this contract owner to unpause this contract
  function unpause() external onlyOwner whenPaused {
    //implement your code here
  }

}
```
> **Good luck and if you have any questions, please reach out to us!**
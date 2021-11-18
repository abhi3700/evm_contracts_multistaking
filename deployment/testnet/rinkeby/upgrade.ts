// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from 'hardhat';
import { Contract, ContractFactory, BigNumber } from 'ethers';


// const PUBLIC_KEY = `0x${process.env.PUBLIC_KEY}` || "";

// TODO: parse the deployed staking token contract address for creating instance here
const tokenContract = require("../../../build/artifacts/contracts/Token.sol/Token.json")
const tokenContractAddress = 'token-contract-address' || "";
// const tokenContractAddress = '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82' || "";           // tested in localhost


// TODO: parse the deployed reward token contract address for creating instance here
const rewardTokenContract = require("../../../build/artifacts/contracts/Token.sol/Token.json")
const rewardTokenContractAddress = 'reward-token-contract-address' || "";
// const rewardTokenContractAddress = '0x9A676e781A523b5d0C0e43731313A708CB607508' || "";     // tested in localhost

// TODO: parse the deployed staking contract address which needs to upgraded with
const UPGRADEABLE_STAKING_CONTRACT = 'upgradeable-staking-contract-address' || "";
// const UPGRADEABLE_STAKING_CONTRACT = '0x0B306BF915C4d645ff596e518fAf3F9669b97016' || "";   // tested in localhost 

async function main(): Promise<void> {
  // Hardhat always runs the compile task when running scripts through it.
  // If this runs in a standalone fashion you may want to call compile manually
  // to make sure everything is compiled
  // await run("compile");
  
  // ==============================================================================
  // get the staking token (for example)
  const token = await ethers.getContractAt(tokenContract.abi, tokenContractAddress);

  // ==============================================================================
  // get the reward token
  const rewardToken = await ethers.getContractAt(rewardTokenContract.abi, rewardTokenContractAddress);
  
  // ==============================================================================
  // We get the staking contract to deploy
  const StakingFactory: ContractFactory = await ethers.getContractFactory("Staking");
  // NOTE: No need to parse the rewardToken address, as storage state variables are maintained in the new deployed staking contract 
  const staking: Contract = await upgrades.upgradeProxy(UPGRADEABLE_STAKING_CONTRACT, StakingFactory);
  console.log("Staking upgraded to:", staking.address);
  console.log(`The transaction that was sent to the network to deploy the staking contract: ${
          staking.deployTransaction.hash}`);

  // --------------------------------------------------------------------------------
  // verify the storage state variables are maintained
  console.log(`reward rate: ${await staking.getRewardRate(token.address)}`);
  console.log(`reward token address: ${await staking.rwTokenAddr.call()}`);
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.  
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });

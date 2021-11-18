// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from 'hardhat';
import { Contract, ContractFactory, BigNumber } from 'ethers';
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(__dirname, "./.env") });

async function main(): Promise<void> {
  // Hardhat always runs the compile task when running scripts through it.
  // If this runs in a standalone fashion you may want to call compile manually
  // to make sure everything is compiled
  // await run("compile");
  
  // ==============================================================================
  // We get the token contract to deploy
  const TokenFactory: ContractFactory = await ethers.getContractFactory(
    'Token',
  );
  // const token: Contract = await TokenFactory.deploy();
  const token: Contract = await upgrades.deployProxy(TokenFactory, ["Master Ventures Token", "MVT"]);
  await token.deployed();
  console.log('Token deployed to: ', token.address);

  console.log(
      `The transaction that was sent to the network to deploy the token contract: ${
          token.deployTransaction.hash
      }`
  );

  // ==============================================================================
  // We get the staking rewards token contract to deploy
  const RewardsTokenFactory: ContractFactory = await ethers.getContractFactory(
    'Token',
  );
  // const rewardToken: Contract = await TokenFactory.deploy();
  const rewardToken: Contract = await upgrades.deployProxy(TokenFactory, ["Master Ventures Rewards Token", "MVRW"]);
  await rewardToken.deployed();
  console.log('staking rewards Token deployed to: ', rewardToken.address);

  console.log(
      `The transaction that was sent to the network to deploy the token contract: ${
          rewardToken.deployTransaction.hash
      }`
  );

  // ==============================================================================
  // We get the staking contract to deploy
  const StakingFactory: ContractFactory = await ethers.getContractFactory(
    'Staking',
  );
  // const stakingC: Contract = await StakingFactory.deploy(token.address);
  const stakingC: Contract = await upgrades.deployProxy(StakingFactory, [rewardToken.address]);
  await stakingC.deployed();
  console.log('Staking deployed to: ', stakingC.address);
  console.log(
      `The transaction that was sent to the network to deploy the staking contract: ${
          stakingC.deployTransaction.hash
      }`
  );

  // --------------------------------------------------------------------------------
  // initiate with setting reward rate
  const tx1 = await stakingC.setRewardRate(token.address, String(20));
  const receipt1 = await tx1.wait();
  console.log("Owner set reward rate & its transaction hash is ", receipt1.transactionHash);

  // --------------------------------------------------------------------------------
  // mint 100,000 reward tokens to staking contract for rewarding
  const tx2 = await rewardToken.mint(stakingC.address, BigNumber.from("100000000000000000000000"));
  const receipt2 = await tx2.wait();
  console.log("Owner minted reward tokens to the staking contract & its transaction hash is ", receipt2.transactionHash);

}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.  
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });

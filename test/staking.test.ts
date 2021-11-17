import { ethers, upgrades } from "hardhat";
import chai from "chai";
import { BigNumber, Contract, Signer, Wallet } from "ethers";
import { deployContract, solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import GenericERC20Artifact from "../build/artifacts/contracts/helper/GenericERC20.sol/GenericERC20.json";
// import { GenericERC20 } from "../build/typechain/GenericERC20"
import {
	MAX_UINT256,
	TIME,
	ZERO_ADDRESS,
	// asyncForEach,
	// deployContractWithLibraries,
	getCurrentBlockTimestamp,
	// getUserTokenBalance,
	// getUserTokenBalances,
	setNextTimestamp,
	setTimestamp,
} from "./testUtils"

chai.use(solidity);
const { expect } = chai;

describe("Multi token Staking contract", () => {
	let stakingContractAddress: string;
	let signers: Array<Signer>;
	let owner : SignerWithAddress, 
		owner2 : SignerWithAddress, 
		addr1 : SignerWithAddress, 
		addr2 : SignerWithAddress, 
		addr3 : SignerWithAddress, 
		addr4 : SignerWithAddress;
	let token: Contract,
		rewardsToken: Contract,
		stakingContract: Contract;

	beforeEach(async () => {
		// get signers
		// M-1
		/*    const signers = await ethers.getSigners();
		owner = signers[0];
		owner2 = signers[1];
		addr1 = signers[3];
		addr2 = signers[4];
		addr3 = signers[5];
		addr4 = signers[6];
		*/

		// M-2
		[owner, owner2, addr1, addr2, addr3, addr4] = await ethers.getSigners();


		// ---------------------------------------------------
		// deploy token contract
		const tokenFactory = await ethers.getContractFactory('Token');
		token = await upgrades.deployProxy(tokenFactory, ["Master Ventures Token", "MVT"]);
		await token.deployed();
		// console.log(`Token contract address: ${token.address}`);

		// console.log(`Token owner: ${await token.owner()}`);


		// expect(await token.totalSupply()).to.eq(BigNumber.from(String(1e24)));      // 1M token minted at constructor
		expect(await token.totalSupply()).to.eq(BigNumber.from("1000000000000000000000000"));      // 1M token minted at constructor

		// ---------------------------------------------------
		// deploy rewards token contract
		const rewardstokenFactory = await ethers.getContractFactory('Token');
		rewardsToken = await upgrades.deployProxy(rewardstokenFactory, ["Master Ventures Rewards Token", "MVRW"]);
		await rewardsToken.deployed();
		// console.log(`Rewards Token contract address: ${token.address}`);

		// console.log(`Rewards Token owner: ${await token.owner()}`);


		// expect(await token.totalSupply()).to.eq(BigNumber.from(String(1e24)));      // 1M token minted at constructor
		expect(await token.totalSupply()).to.eq(BigNumber.from("1000000000000000000000000"));      // 1M token minted at constructor

		// ---------------------------------------------------
		// deploy staking contract
		const stakingFactory = await ethers.getContractFactory('Staking');
		stakingContract = await upgrades.deployProxy(stakingFactory, [rewardsToken.address]);
		await stakingContract.deployed();
		// stakingContractAddress = stakingContract.address;
		// console.log(`Staking contract address: ${stakingContract.address}`);

		// expect(stakingContractAddress).to.not.eq(0);

		// console.log(`Staking owner: ${await stakingContract.owner()}`);

		// Now, set a reward rate as `20%` for the token to be staked
		stakingContract.setRewardRate(token.address, 20);
		expect(await stakingContract.getRewardRate(token.address))
			.to.eq(20);

		// mint 10,000 tokens to each addr1, addr2, addr3
		await token.mint(addr1.address, BigNumber.from("10000000000000000000000"));
		await token.mint(addr2.address, BigNumber.from("10000000000000000000000"));
		await token.mint(addr3.address, BigNumber.from("10000000000000000000000"));

		// verify 10,000 tokens as balance of addr1, addr2, addr3
		expect(await token.balanceOf(addr1.address)).to.eq(BigNumber.from("10000000000000000000000"));
		expect(await token.balanceOf(addr2.address)).to.eq(BigNumber.from("10000000000000000000000"));
		expect(await token.balanceOf(addr3.address)).to.eq(BigNumber.from("10000000000000000000000"));

		// mint 100,000 reward tokens to staking contract
		await rewardsToken.mint(stakingContract.address, BigNumber.from("100000000000000000000000"));

		// verify 10,000 tokens as balance of addr1, addr2, addr3
		expect(await rewardsToken.balanceOf(stakingContract.address)).to.eq(BigNumber.from("100000000000000000000000"));

	});

	describe("Ownable", async () => {
		it("Owner is able to transfer ownership", async () => {
			await expect(stakingContract.transferOwnership(owner2.address))
				.to.emit(stakingContract, 'OwnershipTransferred')
				.withArgs(owner.address, owner2.address);
		});
	});

	describe("Pausable", async () => {
		it("Owner is able to pause when NOT paused", async () => {
			await expect(stakingContract.pause())
				.to.emit(stakingContract, 'Paused')
				.withArgs(owner.address);
		});

		it("Owner is able to unpause when already paused", async () => {
			stakingContract.pause();

			await expect(stakingContract.unpause())
				.to.emit(stakingContract, 'Unpaused')
				.withArgs(owner.address);
		});

		it("Owner is NOT able to pause when already paused", async () => {
			stakingContract.pause();

			await expect(stakingContract.pause())
				.to.be.revertedWith("Pausable: paused");
		});

		it("Owner is NOT able to unpause when already unpaused", async () => {
			stakingContract.pause();

			stakingContract.unpause();

			await expect(stakingContract.unpause())
				.to.be.revertedWith("Pausable: not paused");
		});
	});

	describe("Stake", async () => {
		it("Succeeds with staking", async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr1 stake 1e19 i.e. 10 MVT tokens
			await expect(stakingContract.connect(addr1).stake(token.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "Stake");
				// .withArgs(addr1.address, BigNumber.from("10000000000000000000"), await getCurrentBlockTimestamp());

			const [stakedAmt, stakedAt, unstakedAmt, unstakedAt, rewardAmt] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmt).to.eq(BigNumber.from("10000000000000000000"));
		});

		it("Succeeds with parsing zero staking amount, but ends up in staking entire balance", async () => {
			// first approve the 1e19 i.e. 10,000 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("100000000000000000000000"));

			// addr1 stake 1e19 i.e. 0 MVT tokens, but end up staking its entire token balance
			await expect(stakingContract.connect(addr1).stake(token.address, BigNumber.from("0")))
				.to.emit(stakingContract, "Stake");
				// .withArgs(addr1.address, BigNumber.from("10000000000000000000"), await getCurrentBlockTimestamp());

			const [stakedAmt, stakedAt, unstakedAmt, unstakedAt, rewardAmt] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmt).to.eq(BigNumber.from("10000000000000000000000"));
		});

		it("Reverts when zero token balance", async () => {
			expect(await token.balanceOf(addr4.address)).to.eq(0);
			
			// console.log(`Token owner: ${await token.owner()}`);
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr4).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr4 stake 1e19 i.e. 10 MVT tokens
			await expect(stakingContract.connect(addr4).stake(token.address, BigNumber.from("10000000000000000000")))
				.to.be.revertedWith("ERC20: transfer amount exceeds balance");

		});

		it("Reverts when zero token", async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr1 stake 1e19 i.e. 10 MVT tokens
			await expect(stakingContract.connect(addr1).stake(ZERO_ADDRESS, BigNumber.from("10000000000000000000")))
				.to.be.revertedWith("Invalid token address");

		});

		it("Reverts when token address is not a contract", async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr1 stake 1e19 i.e. 10 MVT tokens with parsing addr1 (not a contract address)
			await expect(stakingContract.connect(addr1).stake(addr1.address, BigNumber.from("10000000000000000000")))
				.to.be.revertedWith("is NOT a contract");

		});

		it("Reverts when already staked", async () => {
			// 1st stake
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr1 stake 1e19 i.e. 10 MVT tokens
			await expect(stakingContract.connect(addr1).stake(token.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "Stake");
				// .withArgs(addr1.address, BigNumber.from("10000000000000000000"), await getCurrentBlockTimestamp());

			const [stakedAmt, stakedAt, unstakedAmt, unstakedAt, rewardAmt] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmt).to.eq(BigNumber.from("10000000000000000000"));

			// Again stake
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr1 stake 1e19 i.e. 10 MVT tokens
			await expect(stakingContract.connect(addr1).stake(token.address, BigNumber.from("10000000000000000000")))
				.to.be.revertedWith("Already staked for this caller");
		});

		it("Reverts when paused", async () => {
			// Pause the contract
			await expect(stakingContract.pause())
				.to.emit(stakingContract, 'Paused')
				.withArgs(owner.address);

			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr1 stake 1e19 i.e. 10 MVT tokens
			await expect(stakingContract.connect(addr1).stake(token.address, BigNumber.from("10000000000000000000")))
				.to.be.revertedWith("Pausable: paused");
		});

	});

/*	describe("Unstake", async () => {
		it("Succeeds with unstaking", async () => {
			// check balance of addr2 before staking
			const addr2BalanceBefore = await token.balanceOf(addr2.address);

			// console.log(`Token owner: ${await token.owner()}`);
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr2).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

					// const currentTimestamp = await getCurrentBlockTimestamp();

			// addr2 stake 1e19 i.e. 10 MVT tokens for addr2
			await expect(stakingContract.connect(addr2).stake(addr2.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "TokenStaked");
				// .withArgs(addr2.address, BigNumber.from("10000000000000000000"), await getCurrentBlockTimestamp());

			// read latest timestamp by last index added into the userTimestamps
			const latestTimestamp = (await stakingContract.getLastTstamp(addr2.address)).toNumber();
			// console.log(latestTimestamp);

			// unstake at the last timestamp
			await expect(stakingContract.connect(addr2).unstakeAt(latestTimestamp, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "TokenUnstakedAt");

			// check balance of addr2 is same as before staking
			const addr2BalanceAfter = await token.balanceOf(addr2.address);
			await expect(addr2BalanceAfter.sub(addr2BalanceBefore)).to.eq(0);

		});

		it("Reverts when parsed timestamp is greater than the current timestamp", async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr2).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			/// addr2 stake 1e19 i.e. 10 MVT tokens for addr2
			await expect(stakingContract.connect(addr2).stake(addr2.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "TokenStaked");

			// read latest timestamp by last index added into the userTimestamps
			const latestTimestamp = (await stakingContract.getLastTstamp(addr2.address)).toNumber();

			// unstake at the (latest timestamp + 1)
			await expect(stakingContract.connect(addr2).unstakeAt(latestTimestamp+1, BigNumber.from("10000000000000000000")))
				.to.be.revertedWith("Stake timestamp must be less than the current timestamp");

		});

		it("Reverts when amount is zero", async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr2).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr2 stake 1e19 i.e. 10 MVT tokens for addr2
			await expect(stakingContract.connect(addr2).stake(addr2.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "TokenStaked");

			// read latest timestamp by last index added into the userTimestamps
			const latestTimestamp = (await stakingContract.getLastTstamp(addr2.address)).toNumber();

			// unstake at the last timestamp with zero amount
			await expect(stakingContract.connect(addr2).unstakeAt(latestTimestamp, BigNumber.from(0)))
				.to.be.revertedWith("Amount must be positive");
		});

		it("Reverts due to insufficient stake amount at timestamp", async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr2).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr2 stake 1e19 i.e. 10 MVT tokens for addr2
			await expect(stakingContract.connect(addr2).stake(addr2.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "TokenStaked");

			// read latest timestamp by last index added into the userTimestamps
			const latestTimestamp = (await stakingContract.getLastTstamp(addr2.address)).toNumber();

			// unstake at the last timestamp with 11 amount
			await expect(stakingContract.connect(addr2).unstakeAt(latestTimestamp, BigNumber.from("11000000000000000000")))
				.to.be.revertedWith("Insufficient staked amount at this timestamp");
		});

		it("Reverts due to invalid stake timestamp", async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr2).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr2addr2 stake 1e19 i.e. 10 MVT tokens for addr2
			await expect(stakingContract.connect(addr2).stake(addr2.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "TokenStaked");

			// read latest timestamp by last index added into the userTimestamps
			const latestTimestamp = (await stakingContract.getLastTstamp(addr2.address)).toNumber();

			// unstake at the random timestamp with 5 amount
			await expect(stakingContract.connect(addr2).unstakeAt(latestTimestamp-1, BigNumber.from("10000000000000000000")))
				.to.be.revertedWith("Invalid stake timestamp for user");
		});

		it("Reverts when paused", async () => {
			// Pause the contract
			await expect(stakingContract.pause())
				.to.emit(stakingContract, 'Paused')
				.withArgs(owner.address);

			// Execute the `stake` function
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr2).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			/// addr2 stake 1e19 i.e. 10 MVT tokens for addr2
			await expect(stakingContract.connect(addr2).stake(addr2.address, BigNumber.from("10000000000000000000")))
				.to.be.revertedWith("Pausable: paused");

			// unstake at the random timestamp with 5 amount
			await expect(stakingContract.connect(addr2).unstakeAt(await getCurrentBlockTimestamp()+5, BigNumber.from("5000000000000000000")))
				.to.be.revertedWith("Pausable: paused");
		});

	});*/


});
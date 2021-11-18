import { ethers, upgrades } from "hardhat";
import chai from "chai";
import { BigNumber, Contract, Signer, Wallet } from "ethers";
import { deployContract, solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
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
		rewardToken: Contract,
		stakingContract: Contract;

	beforeEach(async () => {
		// get signers
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
		const rewardTokenFactory = await ethers.getContractFactory('Token');
		rewardToken = await upgrades.deployProxy(rewardTokenFactory, ["Master Ventures Rewards Token", "MVRW"]);
		await rewardToken.deployed();
		// console.log(`Rewards Token contract address: ${token.address}`);

		// console.log(`Rewards Token owner: ${await token.owner()}`);


		// expect(await token.totalSupply()).to.eq(BigNumber.from(String(1e24)));      // 1M token minted at constructor
		expect(await token.totalSupply()).to.eq(BigNumber.from("1000000000000000000000000"));      // 1M token minted at constructor

		// ---------------------------------------------------
		// deploy staking contract
		const stakingFactory = await ethers.getContractFactory('Staking');
		stakingContract = await upgrades.deployProxy(stakingFactory, [rewardToken.address]);
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
		await rewardToken.mint(stakingContract.address, BigNumber.from("100000000000000000000000"));

		// verify 10,000 tokens as balance of addr1, addr2, addr3
		expect(await rewardToken.balanceOf(stakingContract.address)).to.eq(BigNumber.from("100000000000000000000000"));

	});

	describe("Ownable", async () => {
		it("Should have the correct owner", async () => {
			expect(await token.owner()).to.equal(owner.address);
			expect(await rewardToken.owner()).to.equal(owner.address);
			expect(await stakingContract.owner()).to.equal(owner.address);
		});

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

			const [stakedAmt, , , , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmt).to.eq(BigNumber.from("10000000000000000000"));
		});

		it("Succeeds with parsing zero staking amount, but ends up in staking entire balance", async () => {
			// first approve the 1e19 i.e. 10,000 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("100000000000000000000000"));

			// addr1 stake 1e19 i.e. 0 MVT tokens, but end up staking its entire token balance
			await expect(stakingContract.connect(addr1).stake(token.address, BigNumber.from("0")))
				.to.emit(stakingContract, "Stake");
				// .withArgs(addr1.address, BigNumber.from("10000000000000000000"), await getCurrentBlockTimestamp());

			const [stakedAmt, , , , ] = await stakingContract.getUserRecord(token.address, addr1.address);
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

		it("Reverts when zero token address", async () => {
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

			const [stakedAmt, , , , ] = await stakingContract.getUserRecord(token.address, addr1.address);
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

	describe("Unstake", async () => {
		beforeEach(async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr1 stake 1e19 i.e. 10 MVT tokens
			await expect(stakingContract.connect(addr1).stake(token.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "Stake");
				// .withArgs(addr1.address, BigNumber.from("10000000000000000000"), await getCurrentBlockTimestamp());

			// view staked amount for addr1 after staking
			const [stakedAmtAfterStaking, , , , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmtAfterStaking).to.eq(String(BigNumber.from("10000000000000000000")));

			// Now, the balance of addr1 is 9990 (10,000 - 10) i.e. 9990e18
			expect(await token.balanceOf(addr1.address)).to.eq(BigNumber.from("9990000000000000000000"));
		});

		it("Succeeds with unstaking entirely", async () => {
			// unstake entirely
			await expect(stakingContract.connect(addr1).unstake(token.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "Unstake");

			// view staked, unstaked amounts after unstaking
			const [stakedAmtAfterUnstaking, , unstakedAmtAfterUnstaking, , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmtAfterUnstaking).to.eq(0);
			await expect(unstakedAmtAfterUnstaking).to.eq(BigNumber.from("10000000000000000000"));

		});

		it("Succeeds with unstaking partially", async () => {
			// unstake partially i.e. 1e18 i.e. 1 MVT tokens
			await expect(stakingContract.connect(addr1).unstake(token.address, BigNumber.from("1000000000000000000")))
				.to.emit(stakingContract, "Unstake");

			// view staked, unstaked amounts after unstaking
			const [stakedAmtAfterUnstaking, , unstakedAmtAfterUnstaking, , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmtAfterUnstaking).to.eq(BigNumber.from("9000000000000000000"));
			await expect(unstakedAmtAfterUnstaking).to.eq(BigNumber.from("1000000000000000000"));

		});

		it("Reverts when zero token address", async () => {
			// unstake partially i.e. 1e18 i.e. 1 MVT tokens
			await expect(stakingContract.connect(addr1).unstake(ZERO_ADDRESS, BigNumber.from("1000000000000000000")))
				.to.be.revertedWith("Invalid token address");

		});

		it("Reverts when token address is not a contract", async () => {
			// unstake partially i.e. 1e18 i.e. 1 MVT tokens
			await expect(stakingContract.connect(addr1).unstake(addr2.address, BigNumber.from("1000000000000000000")))
				.to.be.revertedWith("is NOT a contract");

		});

		it("Reverts when amount is zero", async () => {
			// unstake partially i.e. 1e18 i.e. 1 MVT tokens
			await expect(stakingContract.connect(addr1).unstake(token.address, BigNumber.from("0")))
				.to.be.revertedWith("Amount must be positive");
		});



		it("Reverts due to insufficient staked amount", async () => {
			// unstake partially i.e. 11e18 i.e. 11 MVT tokens
			await expect(stakingContract.connect(addr1).unstake(token.address, BigNumber.from("11000000000000000000")))
				.to.be.revertedWith("Insufficient staked amount");
		});

		it("Reverts when paused", async () => {
			// Pause the contract
			await expect(stakingContract.pause())
				.to.emit(stakingContract, 'Paused')
				.withArgs(owner.address);

			// unstake partially i.e. 1e18 i.e. 1 MVT tokens
			await expect(stakingContract.connect(addr1).unstake(token.address, BigNumber.from("1000000000000000000")))
				.to.be.revertedWith("Pausable: paused");
		});

	});

	describe("Withdraw Unstaked", async () => {
		let addr1BalanceBefore: String;

		beforeEach(async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr1 stake 1e19 i.e. 10 MVT tokens
			await expect(stakingContract.connect(addr1).stake(token.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "Stake");
				// .withArgs(addr1.address, BigNumber.from("10000000000000000000"), await getCurrentBlockTimestamp());

			// view staked amount for addr1 after staking
			const [stakedAmtAfterStaking, , , , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmtAfterStaking).to.eq(String(BigNumber.from("10000000000000000000")));

			// Now, the balance of addr1 is 9990 (10,000 - 10) i.e. 9990e18
			expect(await token.balanceOf(addr1.address)).to.eq(BigNumber.from("9990000000000000000000"));

			// unstake partially i.e. 4e18 i.e. 4 MVT tokens
			await expect(stakingContract.connect(addr1).unstake(token.address, BigNumber.from("4000000000000000000")))
				.to.emit(stakingContract, "Unstake");

			// view staked, unstaked amounts after unstaking
			const [stakedAmtAfterUnstaking, , unstakedAmtAfterUnstaking, , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmtAfterUnstaking).to.eq(BigNumber.from("6000000000000000000"));
			await expect(unstakedAmtAfterUnstaking).to.eq(BigNumber.from("4000000000000000000"));

			// check balance of addr1 before withdrawing unstaked amount
			addr1BalanceBefore = await token.balanceOf(addr1.address);
		});

		it("Succeeds with withdraw unstaked amount entirely", async () => {
			// withdraw unstaked entirely i.e. 4e18 i.e. 4 MVT tokens
			await expect(stakingContract.connect(addr1).withdrawUnstaked(token.address, BigNumber.from("4000000000000000000")))
				.to.emit(stakingContract, "WithdrawUnstaked");

			// check balance of addr1 is increased by 4e18 i.e. 4 MVT tokens after withdraw unstaked amount
			const addr1BalanceAfter = await token.balanceOf(addr1.address);
			await expect(addr1BalanceAfter.sub(addr1BalanceBefore)).to.eq(BigNumber.from("4000000000000000000"));
		});

		it("Succeeds with withdraw unstaked amount partially", async () => {
			// withdraw unstaked partially i.e. 1e18 i.e. 1 MVT tokens
			await expect(stakingContract.connect(addr1).withdrawUnstaked(token.address, BigNumber.from("1000000000000000000")))
				.to.emit(stakingContract, "WithdrawUnstaked");

			// check balance of addr1 is increased by 1e18 i.e. 1 MVT tokens after withdraw unstaked amount
			const addr1BalanceAfter = await token.balanceOf(addr1.address);
			await expect(addr1BalanceAfter.sub(addr1BalanceBefore)).to.eq(BigNumber.from("1000000000000000000"));
		});

		it("Reverts when zero token address", async () => {
			// withdraw unstaked partially i.e. 1e18 i.e. 1 MVT tokens
			await expect(stakingContract.connect(addr1).withdrawUnstaked(ZERO_ADDRESS, BigNumber.from("1000000000000000000")))
				.to.be.revertedWith("Invalid token address");

		});

		it("Reverts when token address is not a contract", async () => {
			// withdraw unstaked partially i.e. 1e18 i.e. 1 MVT tokens
			await expect(stakingContract.connect(addr1).withdrawUnstaked(addr2.address, BigNumber.from("1000000000000000000")))
				.to.be.revertedWith("is NOT a contract");

		});

		it("Reverts when amount is zero", async () => {
			// withdraw unstaked partially i.e. 1e18 i.e. 1 MVT tokens
			await expect(stakingContract.connect(addr1).withdrawUnstaked(token.address, BigNumber.from("0")))
				.to.be.revertedWith("Amount must be positive");
		});

		it("Reverts due to insufficient unstaked amount", async () => {
			// withdraw unstaked partially i.e. 5e18 i.e. 5 MVT tokens
			await expect(stakingContract.connect(addr1).withdrawUnstaked(token.address, BigNumber.from("5000000000000000000")))
				.to.be.revertedWith("Insufficient unstaked amount");
		});

		it("Reverts when paused", async () => {
			// Pause the contract
			await expect(stakingContract.pause())
				.to.emit(stakingContract, 'Paused')
				.withArgs(owner.address);

			// withdraw unstaked partially i.e. 1e18 i.e. 1 MVT tokens
			await expect(stakingContract.connect(addr1).withdrawUnstaked(token.address, BigNumber.from("1000000000000000000")))
				.to.be.revertedWith("Pausable: paused");
		});
	});

	describe("Withdraw Reward", async () => {
		let rewardAmtAfterUnstaking: BigNumber;

		beforeEach(async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr1 stake 1e19 i.e. 10 MVT tokens
			await expect(stakingContract.connect(addr1).stake(token.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "Stake");
				// .withArgs(addr1.address, BigNumber.from("10000000000000000000"), await getCurrentBlockTimestamp());

			// view staked amount for addr1 after staking
			const [stakedAmtAfterStaking, , , , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmtAfterStaking).to.eq(String(BigNumber.from("10000000000000000000")));

			// Now, the balance of addr1 is 9990 (10,000 - 10) i.e. 9990e18
			expect(await token.balanceOf(addr1.address)).to.eq(BigNumber.from("9990000000000000000000"));

			// unstake after 20 weeks => get reward amount based on 20 days of staking
			// increase the current timestamp by 20 weeks
			const currentTimestamp = await getCurrentBlockTimestamp();
			await setTimestamp(currentTimestamp + 20 * TIME.WEEKS);

			// unstake partially i.e. 4e18 i.e. 4 MVT tokens
			await expect(stakingContract.connect(addr1).unstake(token.address, BigNumber.from("4000000000000000000")))
				.to.emit(stakingContract, "Unstake");

			// view staked, unstaked amounts after unstaking
			const [stakedAmtAfterUnstaking, , unstakedAmtAfterUnstaking, , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmtAfterUnstaking).to.eq(BigNumber.from("6000000000000000000"));
			await expect(unstakedAmtAfterUnstaking).to.eq(BigNumber.from("4000000000000000000"));

			rewardAmtAfterUnstaking = await stakingContract.getUserRewardAmt(token.address, addr1.address);

		});

		it("Succeeds with withdraw reward amount entirely", async () => {
			// check reward balance of addr1 before withdrawing reward amount
			const addr1rwBalanceBefore = await rewardToken.balanceOf(addr1.address);

			// withdraw reward entirely i.e. `rewardAmtAfterUnstaking`
			await expect(stakingContract.connect(addr1).withdrawReward(token.address, rewardAmtAfterUnstaking))
				.to.emit(stakingContract, "WithdrawRewards");

			// verify that the reward amount in user record
			const rewardAmtAfterWithdrawReward = await stakingContract.getUserRewardAmt(token.address, addr1.address);
			expect(rewardAmtAfterWithdrawReward).to.eq(0);

			// check reward balance of addr1 is increased by `rewardAmtAfterUnstaking` tokens after withdraw reward amount
			const addr1rwBalanceAfter = await rewardToken.balanceOf(addr1.address);
			await expect(addr1rwBalanceAfter.sub(addr1rwBalanceBefore)).to.eq(rewardAmtAfterUnstaking);
		});

		it("Succeeds with withdraw reward amount partially", async () => {
			// check reward balance of addr1 before withdrawing reward amount
			const addr1rwBalanceBefore = await rewardToken.balanceOf(addr1.address);

			// withdraw reward partially i.e. 1 wei (in uint256) reward token
			await expect(stakingContract.connect(addr1).withdrawReward(token.address, String(1)))
				.to.emit(stakingContract, "WithdrawRewards");

			// calc remaining reward `rewardAmtAfterUnstaking` - 1
			const remainingReward = BigNumber.from(rewardAmtAfterUnstaking).sub(1);

			// verify that the reward amount in user record
			const rewardAmtAfterWithdrawReward = await stakingContract.getUserRewardAmt(token.address, addr1.address);
			expect(rewardAmtAfterWithdrawReward).to.eq(remainingReward);

			// check reward balance of addr1 is increased by `rewardAmtAfterUnstaking` tokens after withdraw reward amount
			const addr1rwBalanceAfter = await rewardToken.balanceOf(addr1.address);
			await expect(addr1rwBalanceAfter.sub(addr1rwBalanceBefore)).to.eq(String(1));
		});

		it("Reverts when zero token address", async () => {
			// withdraw reward partially i.e. 1 wei (in uint256) reward token
			await expect(stakingContract.connect(addr1).withdrawReward(ZERO_ADDRESS, String(1)))
				.to.be.revertedWith("Invalid token address");

		});

		it("Reverts when token address is not a contract", async () => {
			// withdraw reward partially i.e. 1 wei (in uint256) reward token
			await expect(stakingContract.connect(addr1).withdrawReward(addr2.address, String(1)))
				.to.be.revertedWith("is NOT a contract");

		});

		it("Reverts when amount is zero", async () => {
			// withdraw reward partially i.e. 0  reward token
			await expect(stakingContract.connect(addr1).withdrawReward(token.address, BigNumber.from("0")))
				.to.be.revertedWith("Amount must be positive");
		});

		it("Reverts due to insufficient reward amount", async () => {
			// withdraw reward partially i.e. 1 wei (in uint256) reward token
			await expect(stakingContract.connect(addr1).withdrawReward(token.address, BigNumber.from(rewardAmtAfterUnstaking).add(1)))
				.to.be.revertedWith("Insufficient reward amount");
		});

		it("Reverts when paused", async () => {
			// Pause the contract
			await expect(stakingContract.pause())
				.to.emit(stakingContract, 'Paused')
				.withArgs(owner.address);

			// withdraw reward partially i.e. 1 wei (in uint256) reward token
			await expect(stakingContract.connect(addr1).withdrawReward(token.address, BigNumber.from("1")))
				.to.be.revertedWith("Pausable: paused");
		});
	});

	describe("Calculate Reward", async () => {
		let rewardAmtAfterUnstaking: BigNumber;

		beforeEach(async () => {
			// first approve the 1e19 i.e. 10 MVT tokens to the contract
			token.connect(addr1).approve(stakingContract.address, BigNumber.from("10000000000000000000"));

			// addr1 stake 1e19 i.e. 10 MVT tokens
			await expect(stakingContract.connect(addr1).stake(token.address, BigNumber.from("10000000000000000000")))
				.to.emit(stakingContract, "Stake");
				// .withArgs(addr1.address, BigNumber.from("10000000000000000000"), await getCurrentBlockTimestamp());

			// view staked amount for addr1 after staking
			const [stakedAmtAfterStaking, , , , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmtAfterStaking).to.eq(String(BigNumber.from("10000000000000000000")));

			// Now, the balance of addr1 is 9990 (10,000 - 10) i.e. 9990e18
			expect(await token.balanceOf(addr1.address)).to.eq(BigNumber.from("9990000000000000000000"));

			// unstake after 20 weeks => get reward amount based on 20 days of staking
			// increase the current timestamp by 20 weeks
			const currentTimestamp = await getCurrentBlockTimestamp();
			await setTimestamp(currentTimestamp + 20 * TIME.WEEKS);

			// unstake partially i.e. 4e18 i.e. 4 MVT tokens
			await expect(stakingContract.connect(addr1).unstake(token.address, BigNumber.from("4000000000000000000")))
				.to.emit(stakingContract, "Unstake");

			// view staked, unstaked amounts after unstaking
			const [stakedAmtAfterUnstaking, , unstakedAmtAfterUnstaking, , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			await expect(stakedAmtAfterUnstaking).to.eq(BigNumber.from("6000000000000000000"));
			await expect(unstakedAmtAfterUnstaking).to.eq(BigNumber.from("4000000000000000000"));

			rewardAmtAfterUnstaking = await stakingContract.getUserRewardAmt(token.address, addr1.address);

		});

		it("Succeeds with manual calculation", async () => {
			const [addr1currentStakedAmt, , , , ] = await stakingContract.getUserRecord(token.address, addr1.address);
			// console.log(`addr1 current staked Amount: ${addr1currentStakedAmt}`);

			const [, , , , addr1stakedAt] = await stakingContract.getUserRecord(token.address, addr1.address);
			// console.log(`addr1 staked At: ${addr1stakedAt}`);

			// console.log(`reward interval: ${await stakingContract.rewardInterval.call()}`);

			// the reward rate is 20%
			const rewardRate = await stakingContract.getRewardRate(token.address);
			// console.log(`reward rate: ${rewardRate}`);

			const currentTimestamp = await getCurrentBlockTimestamp()
			// console.log(`current timestamp: ${currentTimestamp}`);

			// verify the manual calculation (note down values using `console.log`) with the calculated value
			expect(await stakingContract.calculateReward(token.address, addr1.address, addr1currentStakedAmt))
				.to.eq(BigNumber.from("460274010654490106"));

		});

		it("Reverts when zero token address", async () => {
			await expect(stakingContract.calculateReward(ZERO_ADDRESS, addr1.address, String(1)))
				.to.be.revertedWith("Invalid token address");

		});

		it("Reverts when token address is not a contract", async () => {
			await expect(stakingContract.calculateReward(addr2.address, addr1.address, String(1)))
				.to.be.revertedWith("is NOT a contract");

		});

		it("Reverts when amount is zero", async () => {
			await expect(stakingContract.calculateReward(token.address, addr1.address, BigNumber.from("0")))
				.to.be.revertedWith("Amount must be positive");
		});

	});

	describe("Set Reward Rate", async () => {
		it("Succeeds when when set by owner", async () => {
			await expect(stakingContract.setRewardRate(token.address, String(20)));

			const rewardRate = await stakingContract.getRewardRate(token.address);
			await expect(rewardRate).to.eq(String(20));
		});

		it("Reverts when when set by non-owner", async () => {
			await expect(stakingContract.connect(addr1).setRewardRate(token.address, String(20)))
				.to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("Reverts when zero token address", async () => {
			await expect(stakingContract.setRewardRate(ZERO_ADDRESS, String(20)))
				.to.be.revertedWith("Invalid token address");

		});

		it("Reverts when token address is not a contract", async () => {
			await expect(stakingContract.setRewardRate(addr2.address, String(20)))
				.to.be.revertedWith("is NOT a contract");

		});

		it("Reverts when value is zero", async () => {
			await expect(stakingContract.setRewardRate(token.address, String(0)))
				.to.be.revertedWith("reward rate must be between (0 and 100]");
		});

		it("Reverts when value is more than 100", async () => {
			await expect(stakingContract.setRewardRate(token.address, String(101)))
				.to.be.revertedWith("reward rate must be between (0 and 100]");
		});
	});



});
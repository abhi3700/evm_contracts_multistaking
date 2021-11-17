// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import 'hardhat/console.sol';

/**
 * @title A Staking contract for multiple tokens
 */
contract Staking is Initializable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;
    using SafeMathUpgradeable for uint256;

    // ==========State variables====================================
    address public rwTokenAddr;         //reward token address
    uint256 public rewardInterval;                // time duration considered for rewarding. E.g. 1 year

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

    //implement your code here for "rewardRates", a mapping of token address to reward rates. 
    // e.g. if APY is 20%, then rewardRate is 20.
    mapping(address => uint256) public rewardRates;

    // ==========Events=============================================
    event Stake(address indexed user, uint256 amount, uint256 stakedAt);
    event Unstake(address indexed user, uint256 amount, address indexed tokenAddr, uint256 reward, uint256 unstakedAt);
    event WithdrawUnstaked(address indexed user, uint256 amount, uint256 withdrawAt);
    event WithdrawRewards(address indexed user, uint256 amount, uint256 withdrawAt);
    event SetRewardRate(address indexed tokenAddr, uint256 newRewardRate);

    // ==========Constructor========================================
    function initialize(address _rwTokenAddr) external initializer {
        require(_rwTokenAddr != address(0), "Invalid address");
        require(_rwTokenAddr.isContract(), "is NOT a contract");
        
        rwTokenAddr = _rwTokenAddr;
        rewardInterval = 31_536_000;            // 365 days in seconds

        __Ownable_init();        // initialize the ownable contract with owner
    }

    // ==========Functions==========================================
    /// @notice for users to stake tokens
    function stake(address tokenAddr, uint256 amount) external whenNotPaused nonReentrant {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");

        // uint256 newAmount = 0;

        // if amount == 0, then stake the total available balance of caller
        if(amount == 0) {
            amount = IERC20Upgradeable(tokenAddr).balanceOf(_msgSender());
        }

        Record memory recordCaller = records[tokenAddr][_msgSender()];
        require(recordCaller.stakedAmount == 0, "Already staked for this caller");

        records[tokenAddr][_msgSender()].stakedAmount = amount;
        records[tokenAddr][_msgSender()].stakedAt = block.timestamp;
        records[tokenAddr][_msgSender()].unstakedAmount = 0;
        records[tokenAddr][_msgSender()].unstakedAt = 0;
        records[tokenAddr][_msgSender()].rewardAmount = 0;

        // transfer to SC using delegate transfer
        // NOTE: the tokens has to be approved first by the caller to the SC using `approve()` method.
        bool success = IERC20Upgradeable(tokenAddr).transferFrom(_msgSender(), address(this), amount);
        require(success, "Stake: transferFrom function failed");

        emit Stake(_msgSender(), amount, block.timestamp);
    }

    /// @notice for users to unstake their staked tokens
    function unstake(address tokenAddr, uint256 amount) external whenNotPaused {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(amount > 0, "Amount must be positive");

        Record memory recordCaller = records[tokenAddr][_msgSender()];
        require(recordCaller.stakedAmount >= amount, "Insufficient staked amount");

        records[tokenAddr][_msgSender()].stakedAmount = recordCaller.stakedAmount.sub(amount);
        
        // make zero at staketime when there is no staking so as to save storage
        if (recordCaller.stakedAmount == amount) records[tokenAddr][_msgSender()].stakedAt = 0;
        records[tokenAddr][_msgSender()].unstakedAmount = recordCaller.unstakedAmount.add(amount);
        records[tokenAddr][_msgSender()].unstakedAt = block.timestamp;

        // calculate the reward for the amount getting unstaked based on the stake duration
        uint256 calculatedReward = calculateReward(tokenAddr, _msgSender(), amount);
        
        // console.log("unstake() | Calculated reward: %s", calculatedReward);

        records[tokenAddr][_msgSender()].rewardAmount = recordCaller.rewardAmount.add(calculatedReward);

        emit Unstake(_msgSender(), amount, tokenAddr, calculatedReward, block.timestamp);
    }

    /// @notice for users to withdraw their unstaked tokens from this contract to the caller's address
    function withdrawUnstaked(address tokenAddr, uint256 _amount) external whenNotPaused nonReentrant {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(_amount > 0, "Amount must be positive");

        Record memory recordCaller = records[tokenAddr][_msgSender()];
        require(recordCaller.unstakedAmount >= _amount, "Insufficient unstaked amount");

        // update the unstakedAmount
        records[tokenAddr][_msgSender()].unstakedAmount = recordCaller.unstakedAmount.sub(_amount);

        // transfer back tokens to caller using delegate transfer
        bool success = IERC20Upgradeable(tokenAddr).transfer(_msgSender(), _amount);
        require(success, "Unstake: transfer function failed.");

        emit WithdrawUnstaked(_msgSender(), _amount, block.timestamp);
    }

    /// @notice for users to withdraw reward tokens from this contract to the caller's address
    function withdrawReward(address tokenAddr, uint256 _amount) external whenNotPaused nonReentrant {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(_amount > 0, "Amount must be positive");

        Record memory recordCaller = records[tokenAddr][_msgSender()];
        require(recordCaller.rewardAmount >= _amount, "Insufficient reward amount");

        // update the unstakedAmount
        records[tokenAddr][_msgSender()].rewardAmount = recordCaller.rewardAmount.sub(_amount);

        // transfer back reward tokens to caller using delegate transfer
        bool success = IERC20Upgradeable(rwTokenAddr).transfer(_msgSender(), _amount);
        require(success, "Unstake: transfer function failed.");

        emit WithdrawRewards(_msgSender(), _amount, block.timestamp);
    }

    /// @notice to calculate rewards based on the duration of staked tokens, staked token amount, reward rate of the staked token, reward interval
    function calculateReward(address tokenAddr, address user, uint256 _amount) public view returns (uint256) {
        // Reward amount = Staked Amount * Reward Rate * TimeDiff / RewardInterval
        //      Staked Amount : amount getting unstaked for which the reward should be paid to staker
        //      RewardRate : APY %
        //      TimeDiff : current timestamp — last timestamp
        //      RewardInterval: 365 days

        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(user != address(0), "Invalid user address");
        require(_amount > 0, "Amount must be positive");
        require(rewardRates[tokenAddr] != 0, "token reward rate must be non-zero");
        require(rewardInterval != 0, "reward interval must be non-zero");

        Record memory recordCaller = records[tokenAddr][user];

        uint256 rewardAmount = 0;

        uint256 rewardRate = rewardRates[tokenAddr];
        // console.log("calculateReward() | rewardRate: %s", rewardRate);
        
        uint256 timeDiff = block.timestamp.sub(recordCaller.stakedAt);
        // console.log("calculateReward() | timeDiff: %s", timeDiff);
        
        // rewardAmount = (_amount.mul(rewardRate).mul(timeDiff).div(rewardInterval)).div(100);     // divided by 100 bcoz of percentage
        rewardAmount = _amount.mul(rewardRate).mul(timeDiff).div(rewardInterval).div(100);          // divided by 100 bcoz of percentage
        // console.log("calculateReward() | rewardAmount: %s", rewardAmount);

        return rewardAmount;
    }

    /// @notice only for this contract owner to set the reward rate of a staked token
    function setRewardRate(address tokenAddr, uint256 rewardRate) external onlyOwner {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(rewardRate > 0 && rewardRate <= 100, "reward rate must be between (0 and 100]");

        rewardRates[tokenAddr] = rewardRate;
    }

    /// @notice only for this contract owner to pause this contract
    function pause() external onlyOwner whenNotPaused {
        _pause();
    }

    /// @notice only for this contract owner to unpause this contract
    function unpause() external onlyOwner whenPaused {
        _unpause();
    }

    // ==================UTILITY======================================
    /// @notice get user record for a token
    function getUserRecord(address tokenAddr, address user) external view returns (
        uint256 stakedAmt,
        uint256 stakedAt,
        uint256 unstakedAmt,
        uint256 unstakedAt,
        uint256 rewardAmt
    ) {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(user != address(0), "Invalid user address");

        Record memory userRecord = records[tokenAddr][user];
        return (
            userRecord.stakedAmount,
            userRecord.stakedAt,
            userRecord.unstakedAmount,
            userRecord.unstakedAt,
            userRecord.rewardAmount
        );
    }

    /// @notice get user staked amount for a token
/*    function getUserStakedAmt(address tokenAddr, address user) external view returns (uint256) 
    {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(user != address(0), "Invalid user address");

        Record memory userRecord = records[tokenAddr][user];
        
        return userRecord.stakedAmount;
    }
*/
    /// @notice get user staked at for a token
/*    function getUserStakedAt(address tokenAddr, address user) external view returns (uint256) 
    {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(user != address(0), "Invalid user address");

        Record memory userRecord = records[tokenAddr][user];
        
        return userRecord.stakedAt;
    }
*/
    /// @notice get user unstaked amt for a token
/*    function getUserUnstakedAmt(address tokenAddr, address user) external view returns (uint256) 
    {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(user != address(0), "Invalid user address");

        Record memory userRecord = records[tokenAddr][user];
        
        return userRecord.unstakedAmount;
    }
*/
    /// @notice get user unstaked at for a token
/*    function getUserUnstakedAt(address tokenAddr, address user) external view returns (uint256) 
    {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(user != address(0), "Invalid user address");

        Record memory userRecord = records[tokenAddr][user];
        
        return userRecord.unstakedAt;
    }
*/
    /// @notice get user unstaked at for a token
    function getUserRewardAmt(address tokenAddr, address user) external view returns (uint256) 
    {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(user != address(0), "Invalid user address");

        Record memory userRecord = records[tokenAddr][user];
        
        return userRecord.rewardAmount;
    }

    /// @notice get reward rate for a token
    function getRewardRate(address tokenAddr) external view returns (uint256) {
        require(tokenAddr != address(0), "Invalid token address");
        require(tokenAddr.isContract(), "is NOT a contract");

        return rewardRates[tokenAddr];
    }

}
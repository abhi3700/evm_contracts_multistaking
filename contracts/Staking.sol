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
    mapping(address => mapping(address => Record)) records;

    //implement your code here for "rewardRates", a mapping of token address to reward rates. 
    // e.g. if APY is 20%, then rewardRate is 20.
    mapping(address => uint256) rewardRates;

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
    }

    // ==========Functions==========================================
    /// @notice for users to stake tokens
    function stake(address tokenAddr, uint256 amount) external whenNotPaused nonReentrant {
        require(tokenAddr != address(0), "Invalid address");
        require(tokenAddr.isContract(), "is NOT a contract");

        // uint256 newAmount = 0;

        // if amount == 0, then stake the total available balance of caller
        if(amount == 0) {
            amount = IERC20Upgradeable(tokenAddr).balanceOf(_msgSender());
        }

        Record memory recordCaller = records[tokenAddr][_msgSender()];
        require(recordCaller.stakedAmount != 0, "Already staked for this caller");

        recordCaller.stakedAmount = amount;
        recordCaller.stakedAt = block.timestamp;
        recordCaller.unstakedAmount = 0;
        recordCaller.unstakedAt = 0;
        recordCaller.rewardAmount = 0;

        // transfer to SC using delegate transfer
        // NOTE: the tokens has to be approved first by the caller to the SC using `approve()` method.
        bool success = IERC20Upgradeable(tokenAddr).transferFrom(_msgSender(), address(this), amount);
        require(success, "Stake: transferFrom function failed");

        emit Stake(_msgSender(), amount, block.timestamp);
    }

    /// @notice for users to unstake their staked tokens
    function unstake(address tokenAddr, uint256 amount) external whenNotPaused {
        require(tokenAddr != address(0), "Invalid address");
        require(tokenAddr.isContract(), "is NOT a contract");

        Record memory recordCaller = records[tokenAddr][_msgSender()];
        require(recordCaller.stakedAmount != 0, "None staked for this caller");

        records[tokenAddr][_msgSender()].stakedAmount = recordCaller.stakedAmount.sub(amount);
        
        // make zero at staketime when there is no staking so as to save storage
        if (recordCaller.stakedAmount == amount) records[tokenAddr][_msgSender()].stakedAt = 0;
        records[tokenAddr][_msgSender()].unstakedAmount = recordCaller.unstakedAmount.add(amount);
        records[tokenAddr][_msgSender()].unstakedAt = block.timestamp;

        // get the current staked amount (after unstake) for calculating reward
        uint256 currentStakedAmt = recordCaller.stakedAmount.sub(amount);

        uint256 calculatedReward = calculateReward(tokenAddr, _msgSender(), currentStakedAmt);

        records[tokenAddr][_msgSender()].rewardAmount = recordCaller.rewardAmount.add(calculatedReward);

        emit Unstake(_msgSender(), amount, tokenAddr, calculatedReward, block.timestamp);
    }

    /// @notice for users to withdraw their unstaked tokens from this contract to the caller's address
    function withdrawUnstaked(address tokenAddr, uint256 _amount) external whenNotPaused nonReentrant {
        require(tokenAddr != address(0), "Invalid address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(_amount > 0, "Amount must be positive");

        Record memory recordCaller = records[tokenAddr][_msgSender()];
        require(recordCaller.unstakedAmount != 0, "None unstaked for this caller");

        // update the unstakedAmount
        records[tokenAddr][_msgSender()].unstakedAmount = recordCaller.unstakedAmount.sub(_amount);

        // transfer back tokens to caller using delegate transfer
        bool success = IERC20Upgradeable(tokenAddr).transfer(_msgSender(), _amount);
        require(success, "Unstake: transfer function failed.");

        emit WithdrawUnstaked(_msgSender(), _amount, block.timestamp);
    }

    /// @notice for users to withdraw reward tokens from this contract to the caller's address
    function withdrawReward(address tokenAddr, uint256 _amount) external whenNotPaused nonReentrant {
        require(tokenAddr != address(0), "Invalid address");
        require(tokenAddr.isContract(), "is NOT a contract");
        require(_amount > 0, "Amount must be positive");

        Record memory recordCaller = records[tokenAddr][_msgSender()];
        require(recordCaller.rewardAmount != 0, "No reward for this caller");

        // update the unstakedAmount
        records[tokenAddr][_msgSender()].rewardAmount = recordCaller.rewardAmount.sub(_amount);

        // transfer back reward tokens to caller using delegate transfer
        bool success = IERC20Upgradeable(tokenAddr).transfer(_msgSender(), _amount);
        require(success, "Unstake: transfer function failed.");

        emit WithdrawRewards(_msgSender(), _amount, block.timestamp);
    }

    /// @notice to calculate rewards based on the duration of staked tokens, staked token amount, reward rate of the staked token, reward interval
    function calculateReward(address tokenAddr, address user, uint256 _amount) public view returns (uint256) {
        // Reward amount = Staked Amount * Reward Rate * TimeDiff / RewardInterval
        //      Current staked Amount : staked amount *stake fee — unstaked amount *unstake fee
        //      RewardRate : APY %
        //      TimeDiff : current timestamp — last timestamp
        //      RewardInterval: 365 days

        Record memory recordCaller = records[tokenAddr][user];

        uint256 rewardAmount = 0;

        uint256 rewardRate = rewardRates[tokenAddr].div(100);
        uint256 timeDiff = block.timestamp.sub(recordCaller.stakedAt);
        rewardAmount = _amount.mul(rewardRate).mul(timeDiff).div(rewardInterval);

        return rewardAmount;
    }

    /// @notice only for this contract owner to set the reward rate of a staked token
    function setRewardRate(address tokenAddr, uint256 rewardRate) external onlyOwner {
        require(tokenAddr != address(0), "Invalid address");
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

}
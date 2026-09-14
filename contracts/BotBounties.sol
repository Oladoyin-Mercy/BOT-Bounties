// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BotBounties
 * @notice Decentralized Bounty Marketplace on the BOT Chain.
 * @dev Manages complete on-chain bounty lifecycle with native BOT escrow payments and reentrancy protection.
 */
contract BotBounties is ReentrancyGuard {
    /// @notice Lifecycle stages of a bounty
    enum BountyStatus {
        POSTED,     // 0: Bounty is open for hunters to submit work
        SUBMITTED,  // 1: Hunter submitted work proof, awaiting review
        APPROVED,   // 2: Work accepted / in settlement
        PAID,       // 3: Escrow payment released to hunter
        CANCELLED   // 4: Cancelled by creator, escrow refunded
    }

    /// @notice Structure representing a bounty
    struct Bounty {
        uint256 id;
        address payable creator;
        address payable hunter;
        uint256 rewardAmount;
        string title;
        string description;
        string submissionUrl;
        BountyStatus status;
        uint256 createdAt;
        uint256 submittedAt;
        uint256 paidAt;
    }

    /// @dev Total count of bounties created (serves as next bounty ID counter)
    uint256 private _bountyCounter;

    /// @notice Mapping from bounty ID to Bounty struct
    mapping(uint256 => Bounty) public bounties;

    // --- Events ---
    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 rewardAmount,
        string title
    );

    event WorkSubmitted(
        uint256 indexed bountyId,
        address indexed hunter,
        string submissionUrl
    );

    event BountyApproved(
        uint256 indexed bountyId,
        address indexed creator,
        address indexed hunter,
        uint256 rewardAmount
    );

    event BountyPaid(
        uint256 indexed bountyId,
        address indexed hunter,
        uint256 rewardAmount
    );

    event BountyCancelled(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 refundAmount
    );

    // --- Custom Errors ---
    error ZeroDeposit();
    error EmptyTitle();
    error BountyNotFound(uint256 bountyId);
    error NotBountyCreator(uint256 bountyId, address caller);
    error InvalidBountyStatus(uint256 bountyId, BountyStatus currentStatus, BountyStatus expectedStatus);
    error EmptySubmissionUrl();
    error CreatorCannotSubmit(uint256 bountyId, address caller);
    error TransferFailed(address recipient, uint256 amount);

    /**
     * @notice Post a new bounty by depositing native BOT escrow.
     * @param title Title/headline of the bounty.
     * @param description Detailed specifications, deliverables, and acceptance criteria.
     * @return bountyId The unique identifier of the created bounty.
     */
    function createBounty(
        string calldata title,
        string calldata description
    ) external payable returns (uint256 bountyId) {
        if (msg.value == 0) revert ZeroDeposit();
        if (bytes(title).length == 0) revert EmptyTitle();

        bountyId = ++_bountyCounter;

        bounties[bountyId] = Bounty({
            id: bountyId,
            creator: payable(msg.sender),
            hunter: payable(address(0)),
            rewardAmount: msg.value,
            title: title,
            description: description,
            submissionUrl: "",
            status: BountyStatus.POSTED,
            createdAt: block.timestamp,
            submittedAt: 0,
            paidAt: 0
        });

        emit BountyCreated(bountyId, msg.sender, msg.value, title);
    }

    /**
     * @notice Submit proof of work for an open bounty.
     * @param bountyId The ID of the bounty being submitted for.
     * @param submissionUrl URL linking to proof of work (e.g. GitHub PR, preview link).
     */
    function submitWork(
        uint256 bountyId,
        string calldata submissionUrl
    ) external {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.id == 0) revert BountyNotFound(bountyId);
        if (bounty.status != BountyStatus.POSTED && bounty.status != BountyStatus.SUBMITTED) {
            revert InvalidBountyStatus(bountyId, bounty.status, BountyStatus.POSTED);
        }
        if (bytes(submissionUrl).length == 0) revert EmptySubmissionUrl();
        if (msg.sender == bounty.creator) revert CreatorCannotSubmit(bountyId, msg.sender);

        bounty.hunter = payable(msg.sender);
        bounty.submissionUrl = submissionUrl;
        bounty.status = BountyStatus.SUBMITTED;
        bounty.submittedAt = block.timestamp;

        emit WorkSubmitted(bountyId, msg.sender, submissionUrl);
    }

    /**
     * @notice Approve submission and release escrow payment directly to developer.
     * @param bountyId The ID of the bounty to approve and pay.
     */
    function approveAndPay(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.id == 0) revert BountyNotFound(bountyId);
        if (msg.sender != bounty.creator) revert NotBountyCreator(bountyId, msg.sender);
        if (bounty.status != BountyStatus.SUBMITTED) {
            revert InvalidBountyStatus(bountyId, bounty.status, BountyStatus.SUBMITTED);
        }

        address payable hunter = bounty.hunter;
        uint256 reward = bounty.rewardAmount;

        // Effects (CEI pattern)
        bounty.status = BountyStatus.PAID;
        bounty.paidAt = block.timestamp;

        emit BountyApproved(bountyId, msg.sender, hunter, reward);
        emit BountyPaid(bountyId, hunter, reward);

        // Interaction
        (bool success, ) = hunter.call{value: reward}("");
        if (!success) revert TransferFailed(hunter, reward);
    }

    /**
     * @notice Cancel an unclaimed bounty and retrieve deposited escrow funds.
     * @param bountyId The ID of the bounty to cancel.
     */
    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.id == 0) revert BountyNotFound(bountyId);
        if (msg.sender != bounty.creator) revert NotBountyCreator(bountyId, msg.sender);
        if (bounty.status != BountyStatus.POSTED) {
            revert InvalidBountyStatus(bountyId, bounty.status, BountyStatus.POSTED);
        }

        uint256 refundAmount = bounty.rewardAmount;

        // Effects (CEI pattern)
        bounty.status = BountyStatus.CANCELLED;

        emit BountyCancelled(bountyId, msg.sender, refundAmount);

        // Interaction
        (bool success, ) = bounty.creator.call{value: refundAmount}("");
        if (!success) revert TransferFailed(bounty.creator, refundAmount);
    }

    /**
     * @notice Retrieve single bounty details.
     * @param bountyId The ID of the bounty.
     */
    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        if (bounties[bountyId].id == 0) revert BountyNotFound(bountyId);
        return bounties[bountyId];
    }

    /**
     * @notice Returns total number of bounties created.
     */
    function getBountyCount() external view returns (uint256) {
        return _bountyCounter;
    }

    /**
     * @notice Batch fetch bounties for UI display/pagination.
     * @param offset Starting index (1-based).
     * @param limit Maximum number of bounties to retrieve.
     */
    function getBounties(
        uint256 offset,
        uint256 limit
    ) external view returns (Bounty[] memory list) {
        uint256 total = _bountyCounter;
        if (offset == 0 || offset > total || limit == 0) {
            return new Bounty[](0);
        }

        uint256 end = offset + limit - 1;
        if (end > total) {
            end = total;
        }

        uint256 resultSize = end - offset + 1;
        list = new Bounty[](resultSize);

        for (uint256 i = 0; i < resultSize; i++) {
            list[i] = bounties[offset + i];
        }
    }
}


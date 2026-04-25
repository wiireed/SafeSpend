// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Programmable spending vault for AI agents. Users deposit USDC,
///         publish a policy, and authorize a single agent address. The vault
///         only releases funds when the proposed purchase fits the policy.
///
/// Token model: pinned to a single immutable USDC at construction (v1 is
/// single-token by design). All transfers use SafeERC20 and follow CEI.
contract PolicyVault {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_ALLOWLIST = 20;

    IERC20 public immutable usdc;

    struct Policy {
        uint256 maxPerTx;
        uint256 maxTotal;
        uint256 expiresAt;
        address authorizedAgent;
        uint64 version;
        address[] allowedMerchants;
    }

    struct PolicyInput {
        uint256 maxPerTx;
        uint256 maxTotal;
        uint256 expiresAt;
        address authorizedAgent;
        address[] allowedMerchants;
    }

    mapping(address user => Policy) internal _policies;
    mapping(address user => uint256) public spent;
    mapping(address user => uint256) public deposited;

    error UnauthorizedAgent();
    error MerchantNotAllowed();
    error ExceedsPerTx();
    error ExceedsTotal();
    error PolicyExpired();
    error NoPolicy();
    error AllowlistTooLong();
    error InsufficientDeposit();

    event PolicySet(
        address indexed user,
        uint64 indexed version,
        address authorizedAgent,
        uint256 maxPerTx,
        uint256 maxTotal,
        uint256 expiresAt
    );

    event Deposited(address indexed user, address indexed payer, uint256 amount);

    event Withdrawn(address indexed user, uint256 amount);

    event PurchaseApproved(
        address indexed user,
        address indexed merchant,
        uint256 amount,
        bytes32 listingHash,
        uint64 indexed policyVersion
    );

    event PurchaseRejected(
        address indexed user,
        address indexed merchant,
        uint256 amount,
        bytes32 listingHash,
        bytes32 indexed reasonCode,
        string reason
    );

    /// @dev Validation outcome shared by the strict and observable purchase paths.
    enum Reason {
        Ok,
        NoPolicy,
        PolicyExpired,
        MerchantNotAllowed,
        ExceedsPerTx,
        ExceedsTotal,
        InsufficientDeposit
    }

    constructor(IERC20 _usdc) {
        usdc = _usdc;
    }

    // ---------- Policy ----------

    function setPolicy(PolicyInput calldata input) external {
        if (input.allowedMerchants.length > MAX_ALLOWLIST) revert AllowlistTooLong();

        Policy storage p = _policies[msg.sender];
        p.maxPerTx = input.maxPerTx;
        p.maxTotal = input.maxTotal;
        p.expiresAt = input.expiresAt;
        p.authorizedAgent = input.authorizedAgent;
        p.version += 1;

        delete p.allowedMerchants;
        for (uint256 i = 0; i < input.allowedMerchants.length; i++) {
            p.allowedMerchants.push(input.allowedMerchants[i]);
        }

        emit PolicySet(
            msg.sender,
            p.version,
            input.authorizedAgent,
            input.maxPerTx,
            input.maxTotal,
            input.expiresAt
        );
    }

    function getPolicy(address user) external view returns (Policy memory) {
        return _policies[user];
    }

    function allowedMerchants(address user) external view returns (address[] memory) {
        return _policies[user].allowedMerchants;
    }

    function remainingAllowance(address user) external view returns (uint256 perTx, uint256 total) {
        Policy storage p = _policies[user];
        if (p.version == 0 || block.timestamp > p.expiresAt) return (0, 0);

        uint256 spentAmt = spent[user];
        uint256 totalCap = p.maxTotal > spentAmt ? p.maxTotal - spentAmt : 0;
        uint256 unspentDeposit = deposited[user] > spentAmt ? deposited[user] - spentAmt : 0;
        total = totalCap < unspentDeposit ? totalCap : unspentDeposit;
        perTx = p.maxPerTx < total ? p.maxPerTx : total;
    }

    // ---------- Deposit / Withdraw ----------

    function deposit(uint256 amount) external {
        _depositFor(msg.sender, msg.sender, amount);
    }

    function depositFor(address user, uint256 amount) external {
        _depositFor(user, msg.sender, amount);
    }

    function _depositFor(address user, address payer, uint256 amount) internal {
        if (_policies[user].version == 0) revert NoPolicy();

        // CEI: state update before external transfer.
        deposited[user] += amount;
        emit Deposited(user, payer, amount);
        usdc.safeTransferFrom(payer, address(this), amount);
    }

    function withdraw(uint256 amount) external {
        uint256 unspent = deposited[msg.sender] > spent[msg.sender]
            ? deposited[msg.sender] - spent[msg.sender]
            : 0;
        if (amount > unspent) revert InsufficientDeposit();

        // CEI: state update before external transfer.
        deposited[msg.sender] -= amount;
        emit Withdrawn(msg.sender, amount);
        usdc.safeTransfer(msg.sender, amount);
    }

    // ---------- Purchase ----------

    function proposePurchase(
        address user,
        address merchant,
        uint256 amount,
        bytes32 listingHash
    ) external {
        Policy storage p = _policies[user];
        if (p.version == 0) revert NoPolicy();
        if (msg.sender != p.authorizedAgent) revert UnauthorizedAgent();

        Reason r = _validate(p, user, merchant, amount);
        if (r != Reason.Ok) _revertWithReason(r);

        _execute(user, merchant, amount, listingHash, p.version);
    }

    function tryProposePurchase(
        address user,
        address merchant,
        uint256 amount,
        bytes32 listingHash
    ) external returns (bool ok, string memory reason) {
        Policy storage p = _policies[user];

        if (p.version == 0) {
            string memory r = "no_policy";
            emit PurchaseRejected(user, merchant, amount, listingHash, keccak256(bytes(r)), r);
            return (false, r);
        }

        // Same auth gate as the strict path. The `unauthorized_agent` reason
        // code is reserved but unreachable from this path in v1.
        if (msg.sender != p.authorizedAgent) revert UnauthorizedAgent();

        Reason rEnum = _validate(p, user, merchant, amount);
        if (rEnum == Reason.Ok) {
            _execute(user, merchant, amount, listingHash, p.version);
            return (true, "");
        }

        string memory rStr = _reasonString(rEnum);
        emit PurchaseRejected(user, merchant, amount, listingHash, keccak256(bytes(rStr)), rStr);
        return (false, rStr);
    }

    function _validate(
        Policy storage p,
        address user,
        address merchant,
        uint256 amount
    ) internal view returns (Reason) {
        if (block.timestamp > p.expiresAt) return Reason.PolicyExpired;
        if (!_isAllowed(p.allowedMerchants, merchant)) return Reason.MerchantNotAllowed;
        if (amount > p.maxPerTx) return Reason.ExceedsPerTx;
        if (spent[user] + amount > p.maxTotal) return Reason.ExceedsTotal;
        if (spent[user] + amount > deposited[user]) return Reason.InsufficientDeposit;
        return Reason.Ok;
    }

    function _execute(
        address user,
        address merchant,
        uint256 amount,
        bytes32 listingHash,
        uint64 policyVersion
    ) internal {
        // CEI: bump spent before the external transfer.
        spent[user] += amount;
        emit PurchaseApproved(user, merchant, amount, listingHash, policyVersion);
        usdc.safeTransfer(merchant, amount);
    }

    function _isAllowed(address[] storage list, address merchant) internal view returns (bool) {
        uint256 n = list.length;
        for (uint256 i = 0; i < n; i++) {
            if (list[i] == merchant) return true;
        }
        return false;
    }

    function _revertWithReason(Reason r) internal pure {
        if (r == Reason.PolicyExpired) revert PolicyExpired();
        if (r == Reason.MerchantNotAllowed) revert MerchantNotAllowed();
        if (r == Reason.ExceedsPerTx) revert ExceedsPerTx();
        if (r == Reason.ExceedsTotal) revert ExceedsTotal();
        if (r == Reason.InsufficientDeposit) revert InsufficientDeposit();
        // NoPolicy is checked at the entry point so it should not reach here.
        revert NoPolicy();
    }

    function _reasonString(Reason r) internal pure returns (string memory) {
        if (r == Reason.PolicyExpired) return "policy_expired";
        if (r == Reason.MerchantNotAllowed) return "merchant_not_allowed";
        if (r == Reason.ExceedsPerTx) return "exceeds_per_tx";
        if (r == Reason.ExceedsTotal) return "exceeds_total";
        if (r == Reason.InsufficientDeposit) return "insufficient_deposit";
        return "no_policy";
    }
}

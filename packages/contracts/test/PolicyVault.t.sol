// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PolicyVault} from "../src/PolicyVault.sol";

contract PolicyVaultTest is Test {
    MockUSDC internal usdc;
    PolicyVault internal vault;

    address internal user = makeAddr("user");
    address internal agent = makeAddr("agent");
    address internal stranger = makeAddr("stranger");
    address internal merchantA = makeAddr("merchantA");
    address internal merchantB = makeAddr("merchantB");
    address internal merchantC = makeAddr("merchantC");

    uint256 internal constant ONE_USDC = 1e6;
    uint256 internal constant START_TIME = 1_700_000_000;

    function setUp() public {
        vm.warp(START_TIME);
        usdc = new MockUSDC();
        vault = new PolicyVault(usdc);
    }

    // ---------- Helpers ----------

    function _defaultPolicy() internal view returns (PolicyVault.PolicyInput memory input) {
        address[] memory merchants = new address[](2);
        merchants[0] = merchantA;
        merchants[1] = merchantB;
        input = PolicyVault.PolicyInput({
            maxPerTx: 100 * ONE_USDC,
            maxTotal: 500 * ONE_USDC,
            expiresAt: START_TIME + 1 days,
            authorizedAgent: agent,
            allowedMerchants: merchants
        });
    }

    function _setDefaultPolicy() internal {
        vm.prank(user);
        vault.setPolicy(_defaultPolicy());
    }

    function _fundUser(uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(vault), amount);
    }

    function _setupAndDeposit(uint256 amount) internal {
        _setDefaultPolicy();
        _fundUser(amount);
        vm.prank(user);
        vault.deposit(amount);
    }

    function _reasonCode(string memory s) internal pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    // ---------- 1. setPolicy bumps version ----------

    function test_SetPolicy_BumpsVersion() public {
        _setDefaultPolicy();
        assertEq(vault.getPolicy(user).version, 1);

        vm.prank(user);
        vault.setPolicy(_defaultPolicy());
        assertEq(vault.getPolicy(user).version, 2);

        vm.prank(user);
        vault.setPolicy(_defaultPolicy());
        assertEq(vault.getPolicy(user).version, 3);
    }

    // ---------- 2. setPolicy fully replaces prior, does not reset spent ----------

    function test_SetPolicy_FullyReplacesPrior_DoesNotResetSpent() public {
        _setupAndDeposit(500 * ONE_USDC);

        vm.prank(agent);
        vault.proposePurchase(user, merchantA, 50 * ONE_USDC, bytes32(uint256(1)));
        assertEq(vault.spent(user), 50 * ONE_USDC);

        // Replace policy: new agent, new allowlist (only B), tighter limit, longer expiry.
        address newAgent = makeAddr("newAgent");
        address[] memory merchants = new address[](1);
        merchants[0] = merchantB;
        PolicyVault.PolicyInput memory next = PolicyVault.PolicyInput({
            maxPerTx: 10 * ONE_USDC,
            maxTotal: 200 * ONE_USDC,
            expiresAt: START_TIME + 7 days,
            authorizedAgent: newAgent,
            allowedMerchants: merchants
        });
        vm.prank(user);
        vault.setPolicy(next);

        PolicyVault.Policy memory p = vault.getPolicy(user);
        assertEq(p.authorizedAgent, newAgent);
        assertEq(p.maxPerTx, 10 * ONE_USDC);
        assertEq(p.maxTotal, 200 * ONE_USDC);
        assertEq(p.expiresAt, START_TIME + 7 days);
        assertEq(p.version, 2);
        address[] memory got = vault.allowedMerchants(user);
        assertEq(got.length, 1);
        assertEq(got[0], merchantB);
        // spent is preserved across policy resets.
        assertEq(vault.spent(user), 50 * ONE_USDC);
    }

    // ---------- 3. setPolicy reverts when allowlist too long ----------

    function test_SetPolicy_RevertsWhenAllowlistTooLong() public {
        address[] memory tooMany = new address[](21);
        for (uint256 i = 0; i < 21; i++) {
            tooMany[i] = address(uint160(uint256(keccak256(abi.encode(i)))));
        }
        PolicyVault.PolicyInput memory input = PolicyVault.PolicyInput({
            maxPerTx: 1,
            maxTotal: 1,
            expiresAt: START_TIME + 1 days,
            authorizedAgent: agent,
            allowedMerchants: tooMany
        });
        vm.prank(user);
        vm.expectRevert(PolicyVault.AllowlistTooLong.selector);
        vault.setPolicy(input);
    }

    // ---------- 4. deposit reverts when no policy ----------

    function test_Deposit_RevertsWhenNoPolicy() public {
        _fundUser(10 * ONE_USDC);
        vm.prank(user);
        vm.expectRevert(PolicyVault.NoPolicy.selector);
        vault.deposit(10 * ONE_USDC);
    }

    // ---------- 5. depositFor credits target user ----------

    function test_DepositFor_CreditsTargetUser() public {
        _setDefaultPolicy();
        usdc.mint(stranger, 100 * ONE_USDC);
        vm.prank(stranger);
        usdc.approve(address(vault), 100 * ONE_USDC);

        vm.prank(stranger);
        vault.depositFor(user, 100 * ONE_USDC);

        assertEq(vault.deposited(user), 100 * ONE_USDC);
        assertEq(vault.deposited(stranger), 0);
        assertEq(usdc.balanceOf(address(vault)), 100 * ONE_USDC);
        assertEq(usdc.balanceOf(stranger), 0);
    }

    // ---------- 6. depositFor reverts when target has no policy ----------

    function test_DepositFor_RevertsWhenTargetHasNoPolicy() public {
        usdc.mint(stranger, 10 * ONE_USDC);
        vm.prank(stranger);
        usdc.approve(address(vault), 10 * ONE_USDC);
        vm.prank(stranger);
        vm.expectRevert(PolicyVault.NoPolicy.selector);
        vault.depositFor(user, 10 * ONE_USDC);
    }

    // ---------- 7. proposePurchase happy path ----------

    function test_ProposePurchase_HappyPath() public {
        _setupAndDeposit(500 * ONE_USDC);

        vm.expectEmit(true, true, true, true, address(vault));
        emit PolicyVault.PurchaseApproved(user, merchantA, 80 * ONE_USDC, bytes32(uint256(7)), 1);

        vm.prank(agent);
        vault.proposePurchase(user, merchantA, 80 * ONE_USDC, bytes32(uint256(7)));

        assertEq(vault.spent(user), 80 * ONE_USDC);
        assertEq(usdc.balanceOf(merchantA), 80 * ONE_USDC);
        assertEq(usdc.balanceOf(address(vault)), 420 * ONE_USDC);
    }

    // ---------- 8. proposePurchase reverts when unauthorized agent ----------

    function test_ProposePurchase_RevertsWhenUnauthorizedAgent() public {
        _setupAndDeposit(500 * ONE_USDC);
        vm.prank(stranger);
        vm.expectRevert(PolicyVault.UnauthorizedAgent.selector);
        vault.proposePurchase(user, merchantA, 50 * ONE_USDC, bytes32(0));
    }

    // ---------- 9. proposePurchase expired policy ----------

    function test_ProposePurchase_ExpiredPolicy() public {
        _setupAndDeposit(500 * ONE_USDC);
        vm.warp(START_TIME + 2 days);
        vm.prank(agent);
        vm.expectRevert(PolicyVault.PolicyExpired.selector);
        vault.proposePurchase(user, merchantA, 50 * ONE_USDC, bytes32(0));
    }

    // ---------- 10. proposePurchase exceeds per tx ----------

    function test_ProposePurchase_ExceedsPerTx() public {
        _setupAndDeposit(500 * ONE_USDC);
        vm.prank(agent);
        vm.expectRevert(PolicyVault.ExceedsPerTx.selector);
        vault.proposePurchase(user, merchantA, 101 * ONE_USDC, bytes32(0));
    }

    // ---------- 11. proposePurchase exceeds total on second call ----------

    function test_ProposePurchase_ExceedsTotal_OnSecondCall() public {
        _setupAndDeposit(500 * ONE_USDC);

        vm.startPrank(agent);
        // 5 x 100 = 500, fits.
        for (uint256 i = 0; i < 5; i++) {
            vault.proposePurchase(user, merchantA, 100 * ONE_USDC, bytes32(uint256(i)));
        }
        // Sixth purchase pushes over maxTotal=500.
        vm.expectRevert(PolicyVault.ExceedsTotal.selector);
        vault.proposePurchase(user, merchantA, 1 * ONE_USDC, bytes32(uint256(5)));
        vm.stopPrank();
    }

    // ---------- 12. proposePurchase merchant not allowed ----------

    function test_ProposePurchase_MerchantNotAllowed() public {
        _setupAndDeposit(500 * ONE_USDC);
        vm.prank(agent);
        vm.expectRevert(PolicyVault.MerchantNotAllowed.selector);
        vault.proposePurchase(user, merchantC, 50 * ONE_USDC, bytes32(0));
    }

    // ---------- 13. proposePurchase insufficient deposit ----------

    function test_ProposePurchase_InsufficientDeposit() public {
        // Policy permits 500, but only 30 deposited.
        _setupAndDeposit(30 * ONE_USDC);
        vm.prank(agent);
        vm.expectRevert(PolicyVault.InsufficientDeposit.selector);
        vault.proposePurchase(user, merchantA, 80 * ONE_USDC, bytes32(0));
    }

    // ---------- 14. tryProposePurchase happy path emits Approved ----------

    function test_TryProposePurchase_HappyPath_EmitsApproved() public {
        _setupAndDeposit(500 * ONE_USDC);

        vm.expectEmit(true, true, true, true, address(vault));
        emit PolicyVault.PurchaseApproved(user, merchantA, 40 * ONE_USDC, bytes32(uint256(9)), 1);

        vm.prank(agent);
        (bool ok, string memory reason) = vault.tryProposePurchase(
            user, merchantA, 40 * ONE_USDC, bytes32(uint256(9))
        );
        assertTrue(ok);
        assertEq(bytes(reason).length, 0);
        assertEq(vault.spent(user), 40 * ONE_USDC);
    }

    // ---------- 15. tryProposePurchase emits rejected reason ----------

    function test_TryProposePurchase_EmitsRejectedReason() public {
        _setupAndDeposit(500 * ONE_USDC);

        vm.expectEmit(true, true, true, true, address(vault));
        emit PolicyVault.PurchaseRejected(
            user,
            merchantC,
            50 * ONE_USDC,
            bytes32(uint256(3)),
            _reasonCode("merchant_not_allowed"),
            "merchant_not_allowed"
        );

        vm.prank(agent);
        (bool ok, string memory reason) = vault.tryProposePurchase(
            user, merchantC, 50 * ONE_USDC, bytes32(uint256(3))
        );
        assertFalse(ok);
        assertEq(reason, "merchant_not_allowed");
        assertEq(vault.spent(user), 0);
    }

    // ---------- 16. tryProposePurchase reverts when unauthorized agent ----------

    function test_TryProposePurchase_RevertsWhenUnauthorizedAgent() public {
        _setupAndDeposit(500 * ONE_USDC);
        vm.prank(stranger);
        vm.expectRevert(PolicyVault.UnauthorizedAgent.selector);
        vault.tryProposePurchase(user, merchantA, 50 * ONE_USDC, bytes32(0));
    }

    // ---------- 17. remainingAllowance reflects spent and deposits ----------

    function test_RemainingAllowance_ReflectsSpentAndDeposits() public {
        _setupAndDeposit(300 * ONE_USDC);

        (uint256 perTx, uint256 total) = vault.remainingAllowance(user);
        // perTx capped by total = min(500-0, 300-0) = 300, then min(100, 300) = 100.
        assertEq(perTx, 100 * ONE_USDC);
        assertEq(total, 300 * ONE_USDC);

        vm.prank(agent);
        vault.proposePurchase(user, merchantA, 80 * ONE_USDC, bytes32(0));

        (perTx, total) = vault.remainingAllowance(user);
        // total = min(500-80, 300-80) = min(420, 220) = 220; perTx = min(100, 220) = 100.
        assertEq(perTx, 100 * ONE_USDC);
        assertEq(total, 220 * ONE_USDC);
    }

    // ---------- 18. remainingAllowance perTx capped by total ----------

    function test_RemainingAllowance_PerTxCappedByTotal() public {
        _setupAndDeposit(30 * ONE_USDC);
        // policy.maxPerTx = 100, but only 30 unspent deposit. perTx must clamp to 30.
        (uint256 perTx, uint256 total) = vault.remainingAllowance(user);
        assertEq(total, 30 * ONE_USDC);
        assertEq(perTx, 30 * ONE_USDC);
    }

    // ---------- 19. withdraw returns unspent deposit ----------

    function test_Withdraw_ReturnsUnspentDeposit() public {
        _setupAndDeposit(300 * ONE_USDC);

        vm.prank(agent);
        vault.proposePurchase(user, merchantA, 100 * ONE_USDC, bytes32(0));
        // Unspent = deposited(300) - spent(100) = 200.

        uint256 before = usdc.balanceOf(user);

        vm.expectEmit(true, false, false, true, address(vault));
        emit PolicyVault.Withdrawn(user, 200 * ONE_USDC);

        vm.prank(user);
        vault.withdraw(200 * ONE_USDC);

        assertEq(usdc.balanceOf(user) - before, 200 * ONE_USDC);
        assertEq(vault.deposited(user), 100 * ONE_USDC);
        assertEq(vault.spent(user), 100 * ONE_USDC);
    }

    // ---------- 20. withdraw reverts if exceeds unspent ----------

    function test_Withdraw_RevertsIfExceedsUnspent() public {
        _setupAndDeposit(100 * ONE_USDC);
        vm.prank(agent);
        vault.proposePurchase(user, merchantA, 80 * ONE_USDC, bytes32(0));
        // Unspent = 20; asking for 21 must revert.
        vm.prank(user);
        vm.expectRevert(PolicyVault.InsufficientDeposit.selector);
        vault.withdraw(21 * ONE_USDC);
    }

    // ---------- 21. withdraw allowed after expiry ----------

    function test_Withdraw_AllowedAfterExpiry() public {
        _setupAndDeposit(100 * ONE_USDC);
        vm.warp(START_TIME + 30 days);

        vm.prank(user);
        vault.withdraw(100 * ONE_USDC);

        assertEq(usdc.balanceOf(user), 100 * ONE_USDC);
        assertEq(vault.deposited(user), 0);
    }

    // ---------- 22. PurchaseApproved indexes policyVersion ----------

    function test_Events_PurchaseApproved_IndexesPolicyVersion() public {
        _setupAndDeposit(500 * ONE_USDC);

        vm.recordLogs();
        vm.prank(agent);
        vault.proposePurchase(user, merchantA, 50 * ONE_USDC, bytes32(uint256(0xdead)));

        Vm.Log[] memory logs = vm.getRecordedLogs();
        Vm.Log memory ev = _findLog(logs, PolicyVault.PurchaseApproved.selector);
        // topic0 = sig; topic1 = user; topic2 = merchant; topic3 = policyVersion.
        assertEq(ev.topics[0], PolicyVault.PurchaseApproved.selector);
        assertEq(address(uint160(uint256(ev.topics[1]))), user);
        assertEq(address(uint160(uint256(ev.topics[2]))), merchantA);
        assertEq(uint256(ev.topics[3]), 1);
    }

    // ---------- 23. PurchaseRejected indexes reasonCode ----------

    function test_Events_PurchaseRejected_IndexesReasonCode() public {
        _setupAndDeposit(500 * ONE_USDC);

        vm.recordLogs();
        vm.prank(agent);
        vault.tryProposePurchase(user, merchantC, 50 * ONE_USDC, bytes32(uint256(1)));

        Vm.Log[] memory logs = vm.getRecordedLogs();
        Vm.Log memory ev = _findLog(logs, PolicyVault.PurchaseRejected.selector);
        // topic0 = sig; topic1 = user; topic2 = merchant; topic3 = reasonCode.
        assertEq(ev.topics[3], _reasonCode("merchant_not_allowed"));
    }

    function _findLog(Vm.Log[] memory logs, bytes32 sig) internal pure returns (Vm.Log memory) {
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == sig) return logs[i];
        }
        revert("event not found");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PolicyVault} from "../src/PolicyVault.sol";

/// @notice Placeholder test contract. The full 23-test suite lands in PR 2.
contract PolicyVaultTest is Test {
    MockUSDC internal usdc;
    PolicyVault internal vault;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new PolicyVault(usdc);
    }

    function test_Bootstrap_DeploysWithImmutableUsdc() public view {
        assertEq(address(vault.usdc()), address(usdc));
    }
}

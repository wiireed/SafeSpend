// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PolicyVault} from "../src/PolicyVault.sol";

/// @notice Placeholder deploy script. PR 2 wires up address logging,
///         broadcasting, and address export to shared/addresses.ts.
contract Deploy is Script {
    function run() external returns (MockUSDC usdc, PolicyVault vault) {
        vm.startBroadcast();
        usdc = new MockUSDC();
        vault = new PolicyVault(usdc);
        vm.stopBroadcast();
    }
}

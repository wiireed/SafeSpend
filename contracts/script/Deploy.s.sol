// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PolicyVault} from "../src/PolicyVault.sol";

/// @notice Deploys MockUSDC then PolicyVault, and logs the addresses for
///         shared/addresses.ts. Run with:
///           forge script script/Deploy.s.sol --root contracts \
///             --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
contract Deploy is Script {
    function run() external returns (MockUSDC usdc, PolicyVault vault) {
        vm.startBroadcast();
        usdc = new MockUSDC();
        vault = new PolicyVault(usdc);
        vm.stopBroadcast();

        console2.log("MockUSDC:    ", address(usdc));
        console2.log("PolicyVault: ", address(vault));
    }
}

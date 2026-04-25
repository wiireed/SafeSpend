// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";

/// @notice Placeholder seed script. PR 2 mints, approves, calls
///         depositFor for the demo user, and pre-funds the vulnerable
///         session wallet.
contract Seed is Script {
    function run() external {
        vm.startBroadcast();
        // PR 2 fills this in.
        vm.stopBroadcast();
    }
}

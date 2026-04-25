// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PolicyVault} from "../src/PolicyVault.sol";

/// @notice Seeds the demo state on a freshly deployed pair. The demo user
///         must have already signed `setPolicy` (e.g. via the web UI or a
///         separate script) before this seed runs, because `depositFor`
///         requires a policy to exist on the recipient.
///
/// Required env (forge --read-env or shell exports):
///   USDC_ADDRESS              MockUSDC address
///   VAULT_ADDRESS             PolicyVault address
///   USER_ADDRESS              EOA whose policy gets pre-funded
///   AUTHORIZED_AGENT_ADDRESS  EOA we mint to for the vulnerable run
contract Seed is Script {
    uint256 internal constant SAFE_BUDGET = 500e6; // 500 USDC (6 decimals)
    uint256 internal constant VULN_BUDGET = 500e6;

    function run() external {
        MockUSDC usdc = MockUSDC(vm.envAddress("USDC_ADDRESS"));
        PolicyVault vault = PolicyVault(vm.envAddress("VAULT_ADDRESS"));
        address user = vm.envAddress("USER_ADDRESS");
        address agent = vm.envAddress("AUTHORIZED_AGENT_ADDRESS");

        vm.startBroadcast();

        // Safe-mode pre-funding: mint to the deployer, approve the vault,
        // then credit the user via depositFor (no need for the user's key).
        usdc.mint(msg.sender, SAFE_BUDGET);
        usdc.approve(address(vault), SAFE_BUDGET);
        vault.depositFor(user, SAFE_BUDGET);

        // Vulnerable-mode pre-funding: mint directly to the agent/session
        // wallet. No vault involvement; the agent holds spend authority.
        usdc.mint(agent, VULN_BUDGET);

        vm.stopBroadcast();

        console2.log("Seeded SAFE   user=%s amount=%d", user, SAFE_BUDGET);
        console2.log("Seeded VULN   agent=%s amount=%d", agent, VULN_BUDGET);
    }
}

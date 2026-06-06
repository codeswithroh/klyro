// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentRegistry.sol";

/// @notice Registers the Tier 1 bot in AgentRegistry after deployment.
/// Run with: forge script script/PostDeploy.s.sol --rpc-url mantle_sepolia --broadcast
contract PostDeploy is Script {
    function run() external {
        address agentRegistryAddr = vm.envAddress("AGENT_REGISTRY_ADDRESS");
        address botWallet         = vm.envAddress("BOT_WALLET_ADDRESS");
        uint256 deployerKey       = vm.envUint("DEPLOYER_PRIVATE_KEY");

        bytes32 agentId    = keccak256("axiom-7");
        bytes32 identityId = bytes32(0); // Replace with real ERC-8004 identity ID when available

        vm.startBroadcast(deployerKey);

        AgentRegistry registry = AgentRegistry(agentRegistryAddr);
        registry.registerAgent(agentId, botWallet, identityId, "Axiom-7");

        vm.stopBroadcast();

        console2.log("Axiom-7 registered in AgentRegistry");
        console2.log("  agentId:  ", vm.toString(agentId));
        console2.log("  wallet:   ", botWallet);
    }
}

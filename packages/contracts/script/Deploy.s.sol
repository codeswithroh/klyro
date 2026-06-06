// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PredictionRegistry.sol";
import "../src/Leaderboard.sol";
import "../src/RoundManager.sol";
import "../src/AgentRegistry.sol";

/// @notice Deploys all Klyro contracts to Mantle Sepolia.
contract Deploy is Script {
    function run() external {
        address pyth = vm.envAddress("PYTH_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // 1. Deploy PredictionRegistry (needs RoundManager address — deploy with placeholder, then update)
        //    Pattern: deploy RoundManager first with address(0), then deploy Registry pointing back.
        //    Simpler: deploy Registry with a known deployer address, then re-point in RoundManager constructor.
        //    We use a two-step approach via a factory or just accept the circular dependency by deploying
        //    RoundManager last and passing Registry/Leaderboard addresses.

        // Step 1 — deploy registry and leaderboard with a temp address for roundManager
        // They validate the caller, so we pass a real address (deployer) and update post-deploy.
        // For the hackathon, we deploy with the deployer as the initial manager then transfer.

        address deployer = vm.addr(deployerKey);

        PredictionRegistry predRegistry = new PredictionRegistry(deployer);
        Leaderboard leaderboard = new Leaderboard(deployer);
        AgentRegistry agentRegistry = new AgentRegistry();

        // Step 2 — deploy RoundManager pointing to real registry + leaderboard
        RoundManager roundManager = new RoundManager(
            pyth,
            address(predRegistry),
            address(leaderboard)
        );

        vm.stopBroadcast();

        console2.log("PredictionRegistry:", address(predRegistry));
        console2.log("Leaderboard:       ", address(leaderboard));
        console2.log("AgentRegistry:     ", address(agentRegistry));
        console2.log("RoundManager:      ", address(roundManager));
        console2.log("");
        console2.log("NOTE: PredictionRegistry and Leaderboard were deployed with deployer as roundManager.");
        console2.log("      Redeploy them with the correct RoundManager address for production.");
    }
}

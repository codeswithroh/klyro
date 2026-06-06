// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PredictionRegistry.sol";
import "../src/Leaderboard.sol";
import "../src/RoundManager.sol";
import "../src/AgentRegistry.sol";

/// @notice Deploys all Klyro contracts to Mantle Sepolia.
/// @dev Resolves the circular dependency (Registry/Leaderboard need RoundManager address,
///      RoundManager needs Registry/Leaderboard addresses) by pre-computing the RoundManager
///      address from the deployer's nonce before any deployment happens.
contract Deploy is Script {
    function run() external {
        address pyth      = vm.envAddress("PYTH_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer  = vm.addr(deployerKey);

        uint64 nonce = vm.getNonce(deployer);

        // Nonce layout (each new contract increments nonce by 1):
        //   nonce+0  → PredictionRegistry
        //   nonce+1  → Leaderboard
        //   nonce+2  → RoundManager      ← pre-compute this
        //   nonce+3  → AgentRegistry
        address predictedRm = vm.computeCreateAddress(deployer, nonce + 2);

        vm.startBroadcast(deployerKey);

        PredictionRegistry predRegistry = new PredictionRegistry(predictedRm);   // nonce+0
        Leaderboard        leaderboard  = new Leaderboard(predictedRm);           // nonce+1
        RoundManager       roundManager = new RoundManager(                        // nonce+2
            pyth,
            address(predRegistry),
            address(leaderboard)
        );
        AgentRegistry      agentRegistry = new AgentRegistry();                    // nonce+3

        vm.stopBroadcast();

        // Sanity: confirm the prediction matched
        require(address(roundManager) == predictedRm, "Deploy: address prediction mismatch");

        console2.log("=== Klyro Contract Addresses (Mantle Sepolia) ===");
        console2.log("PredictionRegistry:", address(predRegistry));
        console2.log("Leaderboard:       ", address(leaderboard));
        console2.log("RoundManager:      ", address(roundManager));
        console2.log("AgentRegistry:     ", address(agentRegistry));
        console2.log("=================================================");
        console2.log("Next: paste these into apps/web/src/lib/contracts/addresses.ts");
        console2.log("      and packages/bot/.env");
    }
}

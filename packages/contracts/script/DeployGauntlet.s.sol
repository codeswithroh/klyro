// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/GauntletLeaderboard.sol";

contract DeployGauntlet is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        GauntletLeaderboard gl = new GauntletLeaderboard();
        vm.stopBroadcast();

        console2.log("GauntletLeaderboard:", address(gl));
        console2.log("Add to apps/web/.env.local:");
        console2.log("  NEXT_PUBLIC_GAUNTLET_LEADERBOARD_ADDRESS=", address(gl));
    }
}

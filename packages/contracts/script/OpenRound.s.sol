// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/RoundManager.sol";

/// @notice Opens a single prediction round on Mantle Sepolia.
/// Usage: forge script script/OpenRound.s.sol:OpenRound --rpc-url mantle_sepolia --broadcast
contract OpenRound is Script {
    // ETH/USD Pyth feed ID
    bytes32 constant ETH_USD = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    function run() external {
        address rmAddr     = vm.envAddress("ROUND_MANAGER_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        RoundManager rm = RoundManager(rmAddr);

        // Push fresh Pyth price data before opening the round
        // (In production the bot / frontend pushes price before calling openRound)
        // For the script we call openRound directly — RoundManager reads the cached Pyth price.
        uint256 roundId = rm.openRound(ETH_USD, 60); // 60-second round

        vm.stopBroadcast();

        console2.log("Round opened!");
        console2.log("  roundId:", roundId);
        console2.log("  asset:   ETH/USD");
        console2.log("  duration: 60s");
    }
}

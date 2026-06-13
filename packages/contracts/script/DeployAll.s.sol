// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockPyth.sol";
import "../src/PredictionRegistry.sol";
import "../src/Leaderboard.sol";
import "../src/RoundManager.sol";

/**
 * @notice Deploys the full Klyro stack with MockPyth as the oracle.
 *
 * Run:
 *   forge script script/DeployAll.s.sol --rpc-url https://rpc.sepolia.mantle.xyz \
 *     --broadcast --private-key $DEPLOYER_PRIVATE_KEY
 */
contract DeployAll is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // Deploy order:
        //   nonce+0  MockPyth
        //   nonce+1  PredictionRegistry(rm)
        //   nonce+2  Leaderboard(rm)
        //   nonce+3  RoundManager(pyth, reg, lb)  ← predicted address
        address deployer    = vm.addr(deployerKey);
        uint256 nonce       = vm.getNonce(deployer);
        address predictedRm = vm.computeCreateAddress(deployer, nonce + 3);

        MockPyth pyth          = new MockPyth();
        PredictionRegistry reg = new PredictionRegistry(predictedRm);
        Leaderboard lb         = new Leaderboard(predictedRm);
        RoundManager rm        = new RoundManager(address(pyth), address(reg), address(lb));

        require(address(rm) == predictedRm, "RoundManager address mismatch");

        vm.stopBroadcast();

        console2.log("MockPyth           =", address(pyth));
        console2.log("PredictionRegistry =", address(reg));
        console2.log("Leaderboard        =", address(lb));
        console2.log("RoundManager       =", address(rm));
        console2.log("");
        console2.log("Add to apps/web/.env.local:");
        console2.log("  NEXT_PUBLIC_PYTH_ADDRESS=",             address(pyth));
        console2.log("  NEXT_PUBLIC_ROUND_MANAGER_ADDRESS=",    address(rm));
        console2.log("  NEXT_PUBLIC_PREDICTION_REGISTRY_ADDRESS=", address(reg));
        console2.log("  NEXT_PUBLIC_LEADERBOARD_ADDRESS=",      address(lb));
    }
}

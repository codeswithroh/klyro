// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentNFT.sol";

/// @notice Deploys the ERC-8004 AgentNFT contract and mints Axiom-7's identity.
/// @dev    Run with:
///         forge script script/DeployAgentNFT.s.sol \
///           --rpc-url mantle_sepolia --broadcast --verify
contract DeployAgentNFT is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address leaderboard = vm.envAddress("LEADERBOARD_ADDRESS");
        address axiom7Wallet = vm.envAddress("AGENT_WALLET");

        vm.startBroadcast(deployerKey);

        AgentNFT nft = new AgentNFT(leaderboard);

        // Mint Axiom-7's ERC-8004 identity NFT
        uint256 tokenId = nft.mintAgent(
            axiom7Wallet,
            "Axiom-7",
            "contrarian",
            "An autonomous AI price-prediction agent deployed on Mantle. "
            "Axiom-7 uses a multi-signal contrarian strategy: mean reversion (45%), "
            "volatility regime (25%), and RSI-lite oscillator (30%). "
            "Every prediction is immutably recorded on Mantle Network."
        );

        vm.stopBroadcast();

        console2.log("=== AgentNFT (ERC-8004) Deployed ===");
        console2.log("AgentNFT address:      ", address(nft));
        console2.log("Axiom-7 token ID:      ", tokenId);
        console2.log("Axiom-7 wallet:        ", axiom7Wallet);
        console2.log("=====================================");
        console2.log("Next: set NEXT_PUBLIC_AGENT_NFT_ADDRESS=", address(nft));
        console2.log("      in apps/web/.env.local");
    }
}

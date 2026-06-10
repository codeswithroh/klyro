// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BattleResultNFT.sol";

contract DeployBattleNFT is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);

        BattleResultNFT nft = new BattleResultNFT();
        console.log("BattleResultNFT deployed at:", address(nft));

        vm.stopBroadcast();
    }
}

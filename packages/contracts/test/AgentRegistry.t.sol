// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry reg;
    address owner  = makeAddr("owner");
    address wallet = makeAddr("agentWallet");

    bytes32 constant AGENT_ID    = keccak256("axiom-7");
    bytes32 constant IDENTITY_ID = keccak256("erc8004-identity-1");

    function setUp() public {
        vm.prank(owner);
        reg = new AgentRegistry();
    }

    function test_registerAgent_storesAgent() public {
        vm.prank(owner);
        reg.registerAgent(AGENT_ID, wallet, IDENTITY_ID, "Axiom-7");

        AgentRegistry.Agent memory a = reg.getAgent(AGENT_ID);
        assertEq(a.wallet, wallet);
        assertEq(a.erc8004IdentityId, IDENTITY_ID);
        assertEq(a.name, "Axiom-7");
        assertTrue(a.active);
    }

    function test_registerAgent_emitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit AgentRegistry.AgentRegistered(AGENT_ID, wallet, "Axiom-7");
        reg.registerAgent(AGENT_ID, wallet, IDENTITY_ID, "Axiom-7");
    }

    function test_registerAgent_reverts_duplicate() public {
        vm.prank(owner);
        reg.registerAgent(AGENT_ID, wallet, IDENTITY_ID, "Axiom-7");

        vm.prank(owner);
        vm.expectRevert(AgentRegistry.AgentAlreadyRegistered.selector);
        reg.registerAgent(AGENT_ID, wallet, IDENTITY_ID, "Axiom-7");
    }

    function test_registerAgent_reverts_notOwner() public {
        vm.prank(wallet);
        vm.expectRevert(AgentRegistry.NotOwner.selector);
        reg.registerAgent(AGENT_ID, wallet, IDENTITY_ID, "Axiom-7");
    }

    function test_deactivateAgent() public {
        vm.prank(owner);
        reg.registerAgent(AGENT_ID, wallet, IDENTITY_ID, "Axiom-7");

        vm.prank(owner);
        reg.deactivateAgent(AGENT_ID);

        assertFalse(reg.getAgent(AGENT_ID).active);
        assertFalse(reg.isActiveAgent(wallet));
    }

    function test_isActiveAgent_trueForRegistered() public {
        vm.prank(owner);
        reg.registerAgent(AGENT_ID, wallet, IDENTITY_ID, "Axiom-7");
        assertTrue(reg.isActiveAgent(wallet));
    }

    function test_isActiveAgent_falseForUnknown() public view {
        assertFalse(reg.isActiveAgent(wallet));
    }

    function test_getAllAgentIds() public {
        vm.prank(owner);
        reg.registerAgent(AGENT_ID, wallet, IDENTITY_ID, "Axiom-7");

        bytes32[] memory ids = reg.getAllAgentIds();
        assertEq(ids.length, 1);
        assertEq(ids[0], AGENT_ID);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Maps AI agent identities (ERC-8004) to their on-chain wallets and records.
contract AgentRegistry {
    struct Agent {
        address wallet;
        bytes32 erc8004IdentityId; // identity ID from the Mantle ERC-8004 Identity Registry
        string name;
        bool active;
    }

    mapping(bytes32 => Agent) public agents;
    bytes32[] private _agentIds;

    address public owner;

    error NotOwner();
    error AgentAlreadyRegistered();
    error AgentNotFound();

    event AgentRegistered(bytes32 indexed agentId, address wallet, string name);
    event AgentDeactivated(bytes32 indexed agentId);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerAgent(bytes32 agentId, address wallet, bytes32 erc8004IdentityId, string calldata name)
        external
        onlyOwner
    {
        if (agents[agentId].wallet != address(0)) revert AgentAlreadyRegistered();

        agents[agentId] = Agent({
            wallet: wallet,
            erc8004IdentityId: erc8004IdentityId,
            name: name,
            active: true
        });
        _agentIds.push(agentId);

        emit AgentRegistered(agentId, wallet, name);
    }

    function deactivateAgent(bytes32 agentId) external onlyOwner {
        if (agents[agentId].wallet == address(0)) revert AgentNotFound();
        agents[agentId].active = false;
        emit AgentDeactivated(agentId);
    }

    function getAgent(bytes32 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    function getAllAgentIds() external view returns (bytes32[] memory) {
        return _agentIds;
    }

    function isActiveAgent(address wallet) external view returns (bool) {
        for (uint256 i = 0; i < _agentIds.length; i++) {
            Agent storage a = agents[_agentIds[i]];
            if (a.wallet == wallet && a.active) return true;
        }
        return false;
    }
}

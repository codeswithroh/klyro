// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Records each player's UP/DOWN call per round.
contract PredictionRegistry {
    // roundId => player => (hasPredicted, isUp)
    mapping(uint256 => mapping(address => bool)) public hasPredicted;
    mapping(uint256 => mapping(address => bool)) public prediction;

    mapping(uint256 => address[]) private _players;

    address public immutable roundManager;

    error NotRoundManager();

    modifier onlyRoundManager() {
        if (msg.sender != roundManager) revert NotRoundManager();
        _;
    }

    constructor(address _roundManager) {
        roundManager = _roundManager;
    }

    function record(uint256 roundId, address player, bool isUp) external onlyRoundManager {
        hasPredicted[roundId][player] = true;
        prediction[roundId][player] = isUp;
        _players[roundId].push(player);
    }

    function getPredictions(uint256 roundId)
        external
        view
        returns (address[] memory players, bool[] memory calls)
    {
        players = _players[roundId];
        calls = new bool[](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            calls[i] = prediction[roundId][players[i]];
        }
    }

    function getPlayerCount(uint256 roundId) external view returns (uint256) {
        return _players[roundId].length;
    }
}

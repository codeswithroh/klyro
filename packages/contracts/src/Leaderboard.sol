// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Tracks cumulative points, win/loss counts, and streaks for every participant.
contract Leaderboard {
    struct Player {
        uint256 points;
        uint256 wins;
        uint256 losses;
        uint256 streak;
        uint256 bestStreak;
    }

    mapping(address => Player) public players;
    address[] private _ranked; // unsorted; sort off-chain for gas efficiency

    // Points per correct prediction; streak multiplier kicks in at 3+
    uint256 public constant BASE_POINTS = 100;
    uint256 public constant STREAK_MULTIPLIER_THRESHOLD = 3;

    address public immutable roundManager;

    error NotRoundManager();

    event ResultRecorded(address indexed player, bool won, uint256 points, uint256 streak);

    modifier onlyRoundManager() {
        if (msg.sender != roundManager) revert NotRoundManager();
        _;
    }

    constructor(address _roundManager) {
        roundManager = _roundManager;
    }

    function recordResult(address player, bool won) external onlyRoundManager {
        Player storage p = players[player];

        // First time we see this player
        if (p.wins + p.losses == 0) {
            _ranked.push(player);
        }

        if (won) {
            p.wins++;
            p.streak++;
            if (p.streak > p.bestStreak) p.bestStreak = p.streak;

            uint256 multiplier = p.streak >= STREAK_MULTIPLIER_THRESHOLD ? p.streak : 1;
            uint256 earned = BASE_POINTS * multiplier;
            p.points += earned;

            emit ResultRecorded(player, true, earned, p.streak);
        } else {
            p.losses++;
            p.streak = 0;

            emit ResultRecorded(player, false, 0, 0);
        }
    }

    function getPlayer(address player) external view returns (Player memory) {
        return players[player];
    }

    function getAccuracy(address player) external view returns (uint256 bps) {
        Player storage p = players[player];
        uint256 total = p.wins + p.losses;
        if (total == 0) return 0;
        return (p.wins * 10_000) / total; // basis points
    }

    /// @notice Returns all tracked addresses — sort by points off-chain.
    function getAllPlayers() external view returns (address[] memory) {
        return _ranked;
    }

    function totalPlayers() external view returns (uint256) {
        return _ranked.length;
    }
}

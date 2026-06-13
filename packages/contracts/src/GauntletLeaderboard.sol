// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Records final Gauntlet (multi-round challenge) results on-chain.
///         Unlike the main Leaderboard (which is onlyRoundManager), this
///         contract is self-reported: any wallet can submit its own result.
///         For a hackathon demo this is the right tradeoff — one clean tx
///         at the end of a match, no trust assumptions needed for the score
///         since it's the player's own money on the line.
///
///         Future: add an EIP-712 co-signature from the Klyro backend to
///         prevent fake score submissions.
contract GauntletLeaderboard {
    // ── Types ────────────────────────────────────────────────────────────────

    struct MatchRecord {
        uint8   wins;
        uint8   losses;
        uint8   totalRounds;   // 3 (Bo3) or 5 (Bo5)
        uint16  durationSecs;  // per-round duration (15/30/45/60)
        uint32  timestamp;
        uint256 pointsEarned;
    }

    struct PlayerStats {
        uint256 totalPoints;
        uint256 matchesPlayed;
        uint256 matchesWon;    // matches where wins > losses
        uint256 matchesLost;
        uint256 totalRoundWins;
        uint256 totalRoundLosses;
        uint256 bestStreak;    // longest single-match win streak (rounds)
        uint256 currentStreak; // current round-win streak across matches
    }

    // ── Storage ──────────────────────────────────────────────────────────────

    mapping(address => PlayerStats)    public stats;
    mapping(address => MatchRecord[])  private _history;
    address[] private _players;

    uint256 public constant BASE_POINTS               = 100;
    uint256 public constant STREAK_MULTIPLIER_THRESHOLD = 3;

    // ── Events ───────────────────────────────────────────────────────────────

    event GauntletCompleted(
        address indexed player,
        uint8   wins,
        uint8   losses,
        uint8   totalRounds,
        uint16  durationSecs,
        uint256 pointsEarned,
        uint256 timestamp
    );

    // ── Write ─────────────────────────────────────────────────────────────────

    /// @notice Submit the result of a completed Gauntlet match.
    /// @param wins        Number of rounds the player won
    /// @param losses      Number of rounds the player lost
    /// @param totalRounds Total rounds in the series (3 or 5)
    /// @param durationSecs Per-round duration in seconds
    function submitResult(
        uint8  wins,
        uint8  losses,
        uint8  totalRounds,
        uint16 durationSecs
    ) external {
        require(wins + losses <= totalRounds, "Invalid score");
        require(totalRounds == 3 || totalRounds == 5, "Invalid format");
        require(durationSecs >= 15 && durationSecs <= 60, "Invalid duration");

        PlayerStats storage p = stats[msg.sender];

        // Track new players
        if (p.matchesPlayed == 0) {
            _players.push(msg.sender);
        }

        bool matchWon = wins > losses;

        // Points: 100 per round win, streak multiplier if 3+ consecutive wins
        uint256 earned = 0;
        for (uint8 i = 0; i < wins; i++) {
            p.currentStreak++;
            uint256 mult = p.currentStreak >= STREAK_MULTIPLIER_THRESHOLD
                ? p.currentStreak : 1;
            earned += BASE_POINTS * mult;
        }
        // Streak resets on a loss in the series (any losses = streak broken)
        if (losses > 0) {
            p.currentStreak = 0;
        }
        if (p.currentStreak > p.bestStreak) {
            p.bestStreak = p.currentStreak;
        }

        p.totalPoints       += earned;
        p.matchesPlayed     += 1;
        p.totalRoundWins    += wins;
        p.totalRoundLosses  += losses;
        if (matchWon)  p.matchesWon++;
        else           p.matchesLost++;

        _history[msg.sender].push(MatchRecord({
            wins:         wins,
            losses:       losses,
            totalRounds:  totalRounds,
            durationSecs: durationSecs,
            timestamp:    uint32(block.timestamp),
            pointsEarned: earned
        }));

        emit GauntletCompleted(
            msg.sender, wins, losses, totalRounds,
            durationSecs, earned, block.timestamp
        );
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    function getStats(address player) external view returns (PlayerStats memory) {
        return stats[player];
    }

    function getHistory(address player) external view returns (MatchRecord[] memory) {
        return _history[player];
    }

    function getAllPlayers() external view returns (address[] memory) {
        return _players;
    }

    function totalPlayers() external view returns (uint256) {
        return _players.length;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPyth.sol";
import "./PredictionRegistry.sol";
import "./Leaderboard.sol";

/// @notice Opens, locks, and resolves price-prediction rounds against a Pyth oracle.
contract RoundManager {
    // ---- State ----

    struct Round {
        bytes32 priceFeedId;
        int64 startPrice;
        int64 closePrice;
        uint64 startTime;
        uint64 closeTime;
        bool resolved;
        bool outcome; // true = price went UP
    }

    IPyth public immutable pyth;
    PredictionRegistry public immutable registry;
    Leaderboard public immutable leaderboard;

    uint256 public nextRoundId = 1;
    mapping(uint256 => Round) public rounds;

    // ---- Events ----

    event RoundOpened(uint256 indexed roundId, bytes32 priceFeedId, int64 startPrice, uint64 startTime, uint64 closeTime);
    event PredictionLocked(uint256 indexed roundId, address indexed player, bool isUp);
    event RoundResolved(uint256 indexed roundId, int64 closePrice, bool outcome);

    // ---- Errors ----

    error RoundNotOpen();
    error RoundNotClosed();
    error AlreadyPredicted();
    error AlreadyResolved();
    error PriceTooOld();

    constructor(address _pyth, address _registry, address _leaderboard) {
        pyth = IPyth(_pyth);
        registry = PredictionRegistry(_registry);
        leaderboard = Leaderboard(_leaderboard);
    }

    // ---- External ----

    /// @notice Opens a new prediction round.
    /// @param priceFeedId  Pyth price feed ID for the asset.
    /// @param durationSeconds  How long the window stays open.
    function openRound(bytes32 priceFeedId, uint256 durationSeconds) external returns (uint256 roundId) {
        PythPrice memory p = pyth.getPriceNoOlderThan(priceFeedId, 60);

        roundId = nextRoundId++;
        rounds[roundId] = Round({
            priceFeedId: priceFeedId,
            startPrice: p.price,
            closePrice: 0,
            startTime: uint64(block.timestamp),
            closeTime: uint64(block.timestamp + durationSeconds),
            resolved: false,
            outcome: false
        });

        emit RoundOpened(roundId, priceFeedId, p.price, uint64(block.timestamp), uint64(block.timestamp + durationSeconds));
    }

    /// @notice Locks the caller's prediction for a round.
    function lockPrediction(uint256 roundId, bool isUp) external {
        Round storage r = rounds[roundId];
        if (block.timestamp >= r.closeTime) revert RoundNotOpen();
        if (registry.hasPredicted(roundId, msg.sender)) revert AlreadyPredicted();

        registry.record(roundId, msg.sender, isUp);
        emit PredictionLocked(roundId, msg.sender, isUp);
    }

    /// @notice Resolves a round using the Pyth closing price.
    /// @dev Anyone can call this once the window has closed.
    function resolveRound(uint256 roundId) external {
        Round storage r = rounds[roundId];
        if (block.timestamp < r.closeTime) revert RoundNotClosed();
        if (r.resolved) revert AlreadyResolved();

        PythPrice memory p = pyth.getPriceNoOlderThan(r.priceFeedId, 120);
        bool outcome = p.price > r.startPrice;

        r.closePrice = p.price;
        r.resolved = true;
        r.outcome = outcome;

        // Settle leaderboard scores
        (address[] memory players, bool[] memory calls) = registry.getPredictions(roundId);
        for (uint256 i = 0; i < players.length; i++) {
            leaderboard.recordResult(players[i], calls[i] == outcome);
        }

        emit RoundResolved(roundId, p.price, outcome);
    }

    // ---- View ----

    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }

    function isRoundOpen(uint256 roundId) external view returns (bool) {
        Round storage r = rounds[roundId];
        return !r.resolved && block.timestamp < r.closeTime;
    }
}

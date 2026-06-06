// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RoundManager.sol";
import "../src/PredictionRegistry.sol";
import "../src/Leaderboard.sol";
import "./mocks/MockPyth.sol";

contract RoundManagerTest is Test {
    MockPyth      pyth;
    PredictionRegistry registry;
    Leaderboard   leaderboard;
    RoundManager  rm;

    bytes32 constant ETH_FEED = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    function setUp() public {
        pyth = new MockPyth();

        // Pre-compute the address RoundManager will land at (nonce after registry + leaderboard).
        // address(this) nonce: 1 → pyth, 2 → registry, 3 → leaderboard, 4 → rm
        address predictedRm = vm.computeCreateAddress(address(this), 4);

        registry    = new PredictionRegistry(predictedRm); // nonce 2
        leaderboard = new Leaderboard(predictedRm);        // nonce 3
        rm          = new RoundManager(address(pyth), address(registry), address(leaderboard)); // nonce 4

        // Sanity: the rm landed where we predicted
        assertEq(address(rm), predictedRm);

        // Seed a valid price
        pyth.setPrice(ETH_FEED, 341820, 100, -2); // $3418.20
    }

    // ── Open round ────────────────────────────────────────────────────────

    function test_openRound_recordsStartPrice() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);
        RoundManager.Round memory r = rm.getRound(roundId);

        assertEq(roundId, 1);
        assertEq(r.priceFeedId, ETH_FEED);
        assertEq(r.startPrice, 341820);
        assertFalse(r.resolved);
    }

    function test_openRound_emitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit RoundManager.RoundOpened(1, ETH_FEED, 341820, uint64(block.timestamp), uint64(block.timestamp + 60));
        rm.openRound(ETH_FEED, 60);
    }

    // ── Lock prediction ───────────────────────────────────────────────────

    function test_lockPrediction_up() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);

        vm.prank(alice);
        rm.lockPrediction(roundId, true);

        assertTrue(registry.hasPredicted(roundId, alice));
        assertTrue(registry.prediction(roundId, alice));
    }

    function test_lockPrediction_down() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);

        vm.prank(bob);
        rm.lockPrediction(roundId, false);

        assertTrue(registry.hasPredicted(roundId, bob));
        assertFalse(registry.prediction(roundId, bob));
    }

    function test_lockPrediction_reverts_afterClose() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);

        vm.warp(block.timestamp + 61);
        vm.prank(alice);
        vm.expectRevert(RoundManager.RoundNotOpen.selector);
        rm.lockPrediction(roundId, true);
    }

    function test_lockPrediction_reverts_duplicate() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);
        vm.prank(alice);
        rm.lockPrediction(roundId, true);

        vm.prank(alice);
        vm.expectRevert(RoundManager.AlreadyPredicted.selector);
        rm.lockPrediction(roundId, true);
    }

    // ── Resolve ────────────────────────────────────────────────────────────

    function test_resolve_priceUp_aliceWins() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);

        vm.prank(alice);
        rm.lockPrediction(roundId, true); // alice: UP

        vm.prank(bob);
        rm.lockPrediction(roundId, false); // bob: DOWN

        // Warp past close time; set a higher close price
        vm.warp(block.timestamp + 61);
        pyth.setPrice(ETH_FEED, 342500, 100, -2); // price went UP

        rm.resolveRound(roundId);

        RoundManager.Round memory r = rm.getRound(roundId);
        assertTrue(r.resolved);
        assertTrue(r.outcome);  // UP
        assertEq(r.closePrice, 342500);

        // Alice won → gets base points (streak=1, no multiplier)
        Leaderboard.Player memory a = leaderboard.getPlayer(alice);
        assertEq(a.wins, 1);
        assertEq(a.losses, 0);
        assertEq(a.points, 100);
        assertEq(a.streak, 1);

        // Bob lost
        Leaderboard.Player memory bPlayer = leaderboard.getPlayer(bob);
        assertEq(bPlayer.wins, 0);
        assertEq(bPlayer.losses, 1);
        assertEq(bPlayer.points, 0);
        assertEq(bPlayer.streak, 0);
    }

    function test_resolve_priceDown_bobWins() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);

        vm.prank(alice);
        rm.lockPrediction(roundId, true); // alice: UP

        vm.prank(bob);
        rm.lockPrediction(roundId, false); // bob: DOWN

        vm.warp(block.timestamp + 61);
        pyth.setPrice(ETH_FEED, 341000, 100, -2); // price went DOWN

        rm.resolveRound(roundId);

        RoundManager.Round memory r = rm.getRound(roundId);
        assertTrue(r.resolved);
        assertFalse(r.outcome); // DOWN

        Leaderboard.Player memory bPlayer = leaderboard.getPlayer(bob);
        assertEq(bPlayer.wins, 1);
        assertEq(bPlayer.points, 100);
    }

    function test_resolve_reverts_beforeClose() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);
        vm.expectRevert(RoundManager.RoundNotClosed.selector);
        rm.resolveRound(roundId);
    }

    function test_resolve_reverts_doubleResolve() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);
        vm.warp(block.timestamp + 61);
        pyth.setPrice(ETH_FEED, 342500, 100, -2);
        rm.resolveRound(roundId);

        vm.expectRevert(RoundManager.AlreadyResolved.selector);
        rm.resolveRound(roundId);
    }

    function test_resolve_emitsEvent() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);
        vm.warp(block.timestamp + 61);
        pyth.setPrice(ETH_FEED, 342500, 100, -2);

        vm.expectEmit(true, false, false, true);
        emit RoundManager.RoundResolved(roundId, 342500, true);
        rm.resolveRound(roundId);
    }

    // ── Multiple rounds ────────────────────────────────────────────────────

    function test_streakMultiplier_appliedAtThree() public {
        // Alice wins 3 rounds in a row → third win gets 3× multiplier
        for (uint256 i = 0; i < 3; i++) {
            pyth.setPrice(ETH_FEED, 341820, 100, -2);
            uint256 roundId = rm.openRound(ETH_FEED, 60);
            vm.prank(alice);
            rm.lockPrediction(roundId, true);
            vm.warp(block.timestamp + 61);
            pyth.setPrice(ETH_FEED, 341820 + int64(int256(i + 1) * 100), 100, -2); // always UP
            rm.resolveRound(roundId);
        }

        Leaderboard.Player memory a = leaderboard.getPlayer(alice);
        assertEq(a.wins, 3);
        assertEq(a.streak, 3);
        // round 1: 100pts, round 2: 100pts (streak=2, below threshold), round 3: 300pts (streak=3, 3×)
        assertEq(a.points, 500);
    }

    // ── isRoundOpen ────────────────────────────────────────────────────────

    function test_isRoundOpen_trueBeforeClose() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);
        assertTrue(rm.isRoundOpen(roundId));
    }

    function test_isRoundOpen_falseAfterClose() public {
        uint256 roundId = rm.openRound(ETH_FEED, 60);
        vm.warp(block.timestamp + 61);
        assertFalse(rm.isRoundOpen(roundId));
    }
}

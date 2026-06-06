// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Leaderboard.sol";

contract LeaderboardTest is Test {
    Leaderboard lb;
    address manager = makeAddr("manager");
    address alice   = makeAddr("alice");
    address bob     = makeAddr("bob");

    function setUp() public {
        lb = new Leaderboard(manager);
    }

    // ── Record results ─────────────────────────────────────────────────────

    function test_win_grantsBasePoints() public {
        vm.prank(manager);
        lb.recordResult(alice, true);

        Leaderboard.Player memory p = lb.getPlayer(alice);
        assertEq(p.wins, 1);
        assertEq(p.losses, 0);
        assertEq(p.points, 100);
        assertEq(p.streak, 1);
    }

    function test_loss_grantsNoPoints_resetsStreak() public {
        vm.prank(manager);
        lb.recordResult(alice, true);

        vm.prank(manager);
        lb.recordResult(alice, false);

        Leaderboard.Player memory p = lb.getPlayer(alice);
        assertEq(p.wins, 1);
        assertEq(p.losses, 1);
        assertEq(p.points, 100); // no points on loss
        assertEq(p.streak, 0);
    }

    function test_streakMultiplier_kicksInAtThree() public {
        vm.startPrank(manager);
        lb.recordResult(alice, true); // streak=1, pts=100
        lb.recordResult(alice, true); // streak=2, pts=100 (below threshold)
        lb.recordResult(alice, true); // streak=3, pts=300 (3×)
        vm.stopPrank();

        Leaderboard.Player memory p = lb.getPlayer(alice);
        assertEq(p.wins, 3);
        assertEq(p.streak, 3);
        assertEq(p.points, 500); // 100 + 100 + 300
    }

    function test_streakMultiplier_continuesToGrow() public {
        vm.startPrank(manager);
        for (uint256 i = 0; i < 5; i++) {
            lb.recordResult(alice, true);
        }
        vm.stopPrank();

        Leaderboard.Player memory p = lb.getPlayer(alice);
        assertEq(p.streak, 5);
        // 100 + 100 + 300 + 400 + 500 = 1400
        assertEq(p.points, 1400);
    }

    function test_bestStreak_persists_afterReset() public {
        vm.startPrank(manager);
        lb.recordResult(alice, true);
        lb.recordResult(alice, true);
        lb.recordResult(alice, true);
        lb.recordResult(alice, false); // reset streak
        lb.recordResult(alice, true);
        vm.stopPrank();

        Leaderboard.Player memory p = lb.getPlayer(alice);
        assertEq(p.bestStreak, 3);
        assertEq(p.streak, 1);
    }

    // ── Accuracy ──────────────────────────────────────────────────────────

    function test_getAccuracy_50pct() public {
        vm.prank(manager);
        lb.recordResult(alice, true);
        vm.prank(manager);
        lb.recordResult(alice, false);

        // 5000 basis points = 50%
        assertEq(lb.getAccuracy(alice), 5000);
    }

    function test_getAccuracy_zeroForUnknown() public view {
        assertEq(lb.getAccuracy(alice), 0);
    }

    // ── Players list ──────────────────────────────────────────────────────

    function test_getAllPlayers_tracksBothPlayers() public {
        vm.prank(manager);
        lb.recordResult(alice, true);
        vm.prank(manager);
        lb.recordResult(bob, false);

        address[] memory players = lb.getAllPlayers();
        assertEq(players.length, 2);
    }

    function test_getAllPlayers_deduplicates() public {
        vm.prank(manager);
        lb.recordResult(alice, true);
        vm.prank(manager);
        lb.recordResult(alice, true);

        assertEq(lb.totalPlayers(), 1);
    }

    // ── Access control ────────────────────────────────────────────────────

    function test_recordResult_reverts_ifNotManager() public {
        vm.prank(alice);
        vm.expectRevert(Leaderboard.NotRoundManager.selector);
        lb.recordResult(alice, true);
    }
}

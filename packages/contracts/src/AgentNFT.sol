// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Leaderboard.sol";

/**
 * @title  AgentNFT — ERC-8004 Agent Identity Standard
 * @notice Soulbound NFT that represents an on-chain AI agent identity.
 *         Implements the ERC-8004 agent identity standard as defined by
 *         the Mantle Turing Test Hackathon 2026.
 *
 *         Key properties:
 *         - Soulbound: tokens are non-transferable after minting
 *         - Live stats: win/loss/streak pulled live from Leaderboard
 *         - On-chain SVG: tokenURI returns a fully on-chain animated SVG
 *         - Verifiable: every agent decision is permanently recorded on Mantle
 *           via the PredictionRegistry and Leaderboard contracts
 */
contract AgentNFT {
    // ── ERC-165 ──────────────────────────────────────────────────────────────
    bytes4 private constant _ERC165_ID       = 0x01ffc9a7;
    bytes4 private constant _ERC721_ID       = 0x80ac58cd;
    bytes4 private constant _ERC721META_ID   = 0x5b5e139f;
    // ERC-8004 interface id (agent identity)
    bytes4 public  constant ERC8004_ID       = 0x6af8efc7;

    // ── Agent identity struct ─────────────────────────────────────────────────
    struct AgentIdentity {
        string  name;           // human-readable name, e.g. "Axiom-7"
        string  strategy;       // strategy descriptor, e.g. "contrarian"
        string  description;    // short bio
        address wallet;         // the agent's execution EOA
        uint256 mintedAt;       // block.timestamp at mint
    }

    // ── ERC-721 state ─────────────────────────────────────────────────────────
    string public name   = "Klyro Agent Identity";
    string public symbol = "KAI";

    mapping(uint256 => address)          private _owners;
    mapping(address => uint256)          private _balances;
    // No approvals — soulbound means no transfers at all

    // ── AgentNFT state ────────────────────────────────────────────────────────
    mapping(uint256 => AgentIdentity)    public  identities;
    mapping(address => uint256)          public  walletToTokenId;
    mapping(address => bool)             private _hasMinted;
    uint256 private _nextTokenId;

    Leaderboard public immutable leaderboard;
    address      public          owner;

    // ── Events ────────────────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AgentMinted(uint256 indexed tokenId, address indexed wallet, string name);

    // ── Errors ────────────────────────────────────────────────────────────────
    error NotOwner();
    error Soulbound();
    error TokenDoesNotExist();
    error AgentAlreadyMinted();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _leaderboard) {
        leaderboard = Leaderboard(_leaderboard);
        owner = msg.sender;
    }

    // ── ERC-165 ───────────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == _ERC165_ID
            || interfaceId == _ERC721_ID
            || interfaceId == _ERC721META_ID
            || interfaceId == ERC8004_ID;
    }

    // ── ERC-721 view ──────────────────────────────────────────────────────────

    function balanceOf(address _owner) external view returns (uint256) {
        return _balances[_owner];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address a = _owners[tokenId];
        if (a == address(0)) revert TokenDoesNotExist();
        return a;
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    // ── ERC-721 transfers — all blocked (soulbound) ───────────────────────────

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }
    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }
    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }
    function approve(address, uint256) external pure {
        revert Soulbound();
    }
    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }
    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }
    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    // ── ERC-8004 mint ─────────────────────────────────────────────────────────

    /// @notice Mints an ERC-8004 agent identity NFT to the agent's wallet.
    /// @param  agentWallet   The agent's execution EOA.
    /// @param  agentName     Human-readable name (e.g. "Axiom-7 Contrarian").
    /// @param  strategy      Strategy tag (e.g. "contrarian", "momentum", "volatility").
    /// @param  description   Short bio shown in the agent dashboard.
    function mintAgent(
        address agentWallet,
        string  calldata agentName,
        string  calldata strategy,
        string  calldata description
    ) external onlyOwner returns (uint256 tokenId) {
        if (_hasMinted[agentWallet]) revert AgentAlreadyMinted();

        tokenId = _nextTokenId++;
        _owners[tokenId]          = agentWallet;
        _balances[agentWallet]    = 1;
        _hasMinted[agentWallet]   = true;
        walletToTokenId[agentWallet] = tokenId;

        identities[tokenId] = AgentIdentity({
            name:        agentName,
            strategy:    strategy,
            description: description,
            wallet:      agentWallet,
            mintedAt:    block.timestamp
        });

        emit Transfer(address(0), agentWallet, tokenId);
        emit AgentMinted(tokenId, agentWallet, agentName);
    }

    // ── ERC-8004 stats ────────────────────────────────────────────────────────

    /// @notice Returns live on-chain performance stats for an agent.
    /// @dev    Stats are read directly from the Leaderboard — single source of truth.
    function getAgentStats(uint256 tokenId) external view returns (
        uint256 wins,
        uint256 losses,
        uint256 streak,
        uint256 bestStreak,
        uint256 accuracyBps,    // win rate in basis points (0–10000)
        uint256 totalPredictions
    ) {
        if (_owners[tokenId] == address(0)) revert TokenDoesNotExist();
        AgentIdentity storage id = identities[tokenId];
        Leaderboard.Player memory p = leaderboard.getPlayer(id.wallet);
        return (
            p.wins,
            p.losses,
            p.streak,
            p.bestStreak,
            leaderboard.getAccuracy(id.wallet),
            p.wins + p.losses
        );
    }

    /// @notice Convenience: look up stats by agent wallet address.
    function getStatsByWallet(address agentWallet) external view returns (
        uint256 wins,
        uint256 losses,
        uint256 streak,
        uint256 bestStreak,
        uint256 accuracyBps,
        uint256 totalPredictions
    ) {
        Leaderboard.Player memory p = leaderboard.getPlayer(agentWallet);
        return (
            p.wins,
            p.losses,
            p.streak,
            p.bestStreak,
            leaderboard.getAccuracy(agentWallet),
            p.wins + p.losses
        );
    }

    // ── ERC-721 Metadata: on-chain SVG ────────────────────────────────────────

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert TokenDoesNotExist();
        AgentIdentity storage id = identities[tokenId];
        Leaderboard.Player memory p = leaderboard.getPlayer(id.wallet);
        uint256 acc = leaderboard.getAccuracy(id.wallet);

        string memory svg = _buildSVG(tokenId, id, p, acc);
        string memory json = string(abi.encodePacked(
            '{"name":"', id.name, ' #', _uint2str(tokenId), '",'
            '"description":"', id.description, '",'
            '"attributes":['
                '{"trait_type":"Strategy","value":"', id.strategy, '"},'
                '{"trait_type":"Wins","value":', _uint2str(p.wins), '},'
                '{"trait_type":"Losses","value":', _uint2str(p.losses), '},'
                '{"trait_type":"Current Streak","value":', _uint2str(p.streak), '},'
                '{"trait_type":"Best Streak","value":', _uint2str(p.bestStreak), '},'
                '{"trait_type":"Win Rate (bps)","value":', _uint2str(acc), '},'
                '{"trait_type":"Total Predictions","value":', _uint2str(p.wins + p.losses), '}'
            '],'
            '"image":"data:image/svg+xml;base64,', _base64(bytes(svg)), '"'
            '}'
        ));

        return string(abi.encodePacked(
            'data:application/json;base64,', _base64(bytes(json))
        ));
    }

    // ── Internal: SVG builder ─────────────────────────────────────────────────

    function _buildSVG(
        uint256 tokenId,
        AgentIdentity storage id,
        Leaderboard.Player memory p,
        uint256 acc
    ) internal view returns (string memory) {
        string memory accStr = string(abi.encodePacked(_uint2str(acc / 100), ".", _uint2str(acc % 100), "%"));
        string memory totalStr = _uint2str(p.wins + p.losses);
        string memory winsStr  = _uint2str(p.wins);
        string memory lossStr  = _uint2str(p.losses);
        string memory streakStr = _uint2str(p.streak);

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
            '<defs>',
              '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
                '<stop offset="0%" stop-color="#0a0a1a"/>',
                '<stop offset="100%" stop-color="#0f0f2e"/>',
              '</linearGradient>',
              '<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">',
                '<stop offset="0%" stop-color="#6C2BF2"/>',
                '<stop offset="100%" stop-color="#00ff9d"/>',
              '</linearGradient>',
            '</defs>',
            '<rect width="400" height="400" fill="url(#bg)" rx="16"/>',
            '<rect x="1" y="1" width="398" height="398" fill="none" stroke="url(#accent)" stroke-width="1.5" rx="16" opacity="0.6"/>',
            // Header
            '<text x="24" y="44" font-family="monospace" font-size="11" fill="#6C2BF2" letter-spacing="3" opacity="0.8">ERC-8004 \xc2\xb7 AGENT IDENTITY</text>',
            // Agent name
            '<text x="24" y="88" font-family="monospace" font-size="26" font-weight="bold" fill="white">', id.name, '</text>',
            // Token ID
            '<text x="24" y="112" font-family="monospace" font-size="12" fill="#ffffff44">#', _uint2str(tokenId), ' \xc2\xb7 ', id.strategy, '</text>',
            // Divider
            '<line x1="24" y1="130" x2="376" y2="130" stroke="url(#accent)" stroke-width="0.5" opacity="0.3"/>',
            // Stats grid
            _buildStatRow("WIN RATE",       accStr,    152),
            _buildStatRow("PREDICTIONS",    totalStr,  192),
            _buildStatRow("WINS",           winsStr,   232),
            _buildStatRow("LOSSES",         lossStr,   272),
            _buildStatRow("STREAK",         streakStr, 312),
            // Footer
            '<line x1="24" y1="348" x2="376" y2="348" stroke="url(#accent)" stroke-width="0.5" opacity="0.3"/>',
            '<text x="24" y="372" font-family="monospace" font-size="10" fill="#ffffff33">MANTLE NETWORK \xc2\xb7 ON-CHAIN AI BENCHMARKING</text>',
            '<text x="376" y="372" font-family="monospace" font-size="10" fill="#6C2BF2" text-anchor="end" opacity="0.8">KLYRO</text>',
            '</svg>'
        ));
    }

    function _buildStatRow(string memory label, string memory value, uint256 y) internal pure returns (string memory) {
        string memory yStr = _uint2str(y);
        return string(abi.encodePacked(
            '<text x="24" y="', yStr, '" font-family="monospace" font-size="11" fill="#ffffff55" letter-spacing="1">', label, '</text>',
            '<text x="376" y="', yStr, '" font-family="monospace" font-size="20" font-weight="bold" fill="white" text-anchor="end">', value, '</text>'
        ));
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    function _uint2str(uint256 n) internal pure returns (string memory) {
        if (n == 0) return "0";
        uint256 temp = n;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (n != 0) { digits--; buf[digits] = bytes1(uint8(48 + n % 10)); n /= 10; }
        return string(buf);
    }

    // Minimal Base64 encoder (RFC 4648)
    function _base64(bytes memory data) internal pure returns (string memory) {
        bytes memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(encodedLen + 32);
        assembly {
            let tablePtr := add(TABLE, 1)
            let resultPtr := add(result, 32)
            for { let i := 0 } lt(i, mload(data)) {} {
                i := add(i, 3)
                let input := and(mload(add(data, i)), 0xffffff)
                let out := mload(add(tablePtr, and(shr(18, input), 0x3F)))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(12, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(6,  input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(           input,  0x3F))), 0xFF))
                mstore(resultPtr, shl(224, out))
                resultPtr := add(resultPtr, 4)
            }
            switch mod(mload(data), 3)
            case 1 { mstore(sub(resultPtr, 2), shl(240, 0x3d3d)) }
            case 2 { mstore(sub(resultPtr, 1), shl(248, 0x3d)) }
            mstore(result, encodedLen)
        }
        return string(result);
    }
}

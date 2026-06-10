// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BattleResultNFT
 * @notice Soulbound-style NFT that immortalises every Klyro duel result on Mantle.
 *         Anyone can mint one per (player, roundId) pair — the mint is permissionless
 *         and free so results can be claimed immediately after a round settles.
 *
 *         Metadata is fully on-chain SVG — no IPFS, no external dependencies.
 *
 * @dev Minimal ERC-721 (no OpenZeppelin). Transfer NOT blocked — players can hold
 *      these in any wallet / NFT marketplace.
 */
contract BattleResultNFT {
    // ── Storage ──────────────────────────────────────────────────────────────

    struct Battle {
        address player;
        uint256 roundId;
        bool    humanCall;   // true = UP
        bool    outcome;     // true = price went UP
        uint8   verdict;     // 0=win 1=lose 2=draw
        uint64  mintedAt;
    }

    mapping(uint256 => Battle)  public battles;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _approvals;
    mapping(address => mapping(address => bool)) private _opApprovals;

    // Prevent double-mint for same (player, roundId)
    mapping(address => mapping(uint256 => bool)) public hasMinted;

    uint256 private _nextTokenId;

    string public constant name   = "Klyro Battle Result";
    string public constant symbol = "KBR";

    // ── Events ────────────────────────────────────────────────────────────────

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event BattleMinted(uint256 indexed tokenId, address indexed player, uint256 indexed roundId, uint8 verdict);

    // ── Errors ────────────────────────────────────────────────────────────────

    error AlreadyMinted();
    error NotOwner();
    error TokenDoesNotExist();
    error NotApproved();

    // ── Mint ──────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a battle result card.
     * @param player     The human player's address.
     * @param roundId    The on-chain round ID.
     * @param humanCall  true = player called UP.
     * @param outcome    true = price actually went UP.
     * @param verdict    0=win 1=lose 2=draw (computed off-chain by the front-end).
     */
    function mintBattle(
        address player,
        uint256 roundId,
        bool    humanCall,
        bool    outcome,
        uint8   verdict
    ) external returns (uint256 tokenId) {
        if (hasMinted[player][roundId]) revert AlreadyMinted();
        hasMinted[player][roundId] = true;

        tokenId = _nextTokenId++;
        _owners[tokenId] = player;
        unchecked { _balances[player]++; }

        battles[tokenId] = Battle({
            player:    player,
            roundId:   roundId,
            humanCall: humanCall,
            outcome:   outcome,
            verdict:   verdict,
            mintedAt:  uint64(block.timestamp)
        });

        emit Transfer(address(0), player, tokenId);
        emit BattleMinted(tokenId, player, roundId, verdict);
    }

    // ── ERC-721 view ─────────────────────────────────────────────────────────

    function totalSupply() external view returns (uint256) { return _nextTokenId; }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _owners[tokenId];
        if (o == address(0)) revert TokenDoesNotExist();
        return o;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);
        return _approvals[tokenId];
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _opApprovals[owner][operator];
    }

    function approve(address to, uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender && !_opApprovals[ownerOf(tokenId)][msg.sender]) revert NotApproved();
        _approvals[tokenId] = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        _opApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        if (msg.sender != owner && !_opApprovals[owner][msg.sender] && _approvals[tokenId] != msg.sender)
            revert NotApproved();
        if (owner != from) revert NotOwner();
        delete _approvals[tokenId];
        unchecked { _balances[from]--; _balances[to]++; }
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        this.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        this.transferFrom(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd  // ERC-721
            || interfaceId == 0x5b5e139f  // ERC-721Metadata
            || interfaceId == 0x01ffc9a7; // ERC-165
    }

    // ── tokenURI (fully on-chain SVG) ─────────────────────────────────────────

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        Battle memory b = battles[tokenId];
        if (_owners[tokenId] == address(0)) revert TokenDoesNotExist();

        string memory verdictLabel;
        string memory verdictColor;
        string memory strategyType;
        string memory badge;

        if (b.verdict == 0) {
            verdictLabel  = "YOU WON";
            verdictColor  = "#10b981";
            // Won: human called differently from AI and was right
            strategyType  = b.humanCall == b.outcome
                ? (b.humanCall ? "Momentum Alpha" : "Contrarian Alpha")
                : "Unexpected Edge";
            badge         = "AI Slayer";
        } else if (b.verdict == 1) {
            verdictLabel  = "YOU LOST";
            verdictColor  = "#f43f5e";
            strategyType  = b.humanCall ? "Bull Thesis" : "Bear Thesis";
            badge         = "Level Up";
        } else {
            verdictLabel  = "DRAW";
            verdictColor  = "#fbbf24";
            strategyType  = "Parallel Intelligence";
            badge         = "Mind Sync";
        }

        string memory humanDir  = b.humanCall  ? unicode"▲ UP" : unicode"▼ DOWN";
        string memory outcomeDir = b.outcome   ? unicode"▲ UP" : unicode"▼ DOWN";

        string memory addrShort = _addrShort(b.player);

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">',
            '<defs>',
              '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
                '<stop offset="0%" stop-color="#02040A"/>',
                '<stop offset="100%" stop-color="#0A0418"/>',
              '</linearGradient>',
              '<linearGradient id="vg" x1="0" y1="0" x2="1" y2="0">',
                '<stop offset="0%" stop-color="', verdictColor, '"/>',
                '<stop offset="100%" stop-color="', verdictColor, '88"/>',
              '</linearGradient>',
            '</defs>',

            // Background
            '<rect width="400" height="520" rx="20" fill="url(#bg)"/>',
            '<rect width="400" height="520" rx="20" fill="none" stroke="', verdictColor, '" stroke-width="1.5" opacity="0.5"/>',

            // Glow behind verdict
            '<ellipse cx="200" cy="180" rx="160" ry="100" fill="', verdictColor, '" opacity="0.06"/>',

            // Top badge
            '<rect x="130" y="24" width="140" height="26" rx="13" fill="', verdictColor, '" opacity="0.15"/>',
            '<rect x="130" y="24" width="140" height="26" rx="13" fill="none" stroke="', verdictColor, '" stroke-width="1" opacity="0.4"/>',
            '<text x="200" y="41" text-anchor="middle" font-family="monospace" font-size="10" fill="', verdictColor, '" letter-spacing="2">KLYRO BATTLE</text>',

            // Verdict
            '<text x="200" y="130" text-anchor="middle" font-family="monospace" font-size="46" font-weight="900" fill="url(#vg)" letter-spacing="-1">',
              verdictLabel,
            '</text>',

            // Strategy type pill
            '<rect x="100" y="148" width="200" height="22" rx="11" fill="', verdictColor, '" opacity="0.12"/>',
            '<text x="200" y="163" text-anchor="middle" font-family="monospace" font-size="10" fill="', verdictColor, '" opacity="0.9">',
              strategyType,
            '</text>',

            // Separator
            '<line x1="40" y1="192" x2="360" y2="192" stroke="white" stroke-width="0.5" opacity="0.1"/>',

            // You vs AI row
            '<text x="200" y="220" text-anchor="middle" font-family="monospace" font-size="11" fill="white" opacity="0.3">YOU  vs  AXIOM-7</text>',

            // Calls
            '<text x="100" y="256" text-anchor="middle" font-family="monospace" font-size="22" font-weight="bold" fill="', (b.humanCall ? "#10b981" : "#f43f5e"), '">',
              humanDir,
            '</text>',
            '<text x="300" y="256" text-anchor="middle" font-family="monospace" font-size="14" fill="white" opacity="0.35">?</text>',

            // Outcome row
            '<line x1="40" y1="280" x2="360" y2="280" stroke="white" stroke-width="0.5" opacity="0.1"/>',
            '<text x="200" y="308" text-anchor="middle" font-family="monospace" font-size="11" fill="white" opacity="0.3">ETH MOVED</text>',
            '<text x="200" y="342" text-anchor="middle" font-family="monospace" font-size="28" font-weight="bold" fill="', (b.outcome ? "#10b981" : "#f43f5e"), '">',
              outcomeDir,
            '</text>',

            // Badge
            '<rect x="140" y="370" width="120" height="30" rx="15" fill="', verdictColor, '" opacity="0.2"/>',
            '<rect x="140" y="370" width="120" height="30" rx="15" fill="none" stroke="', verdictColor, '" stroke-width="1" opacity="0.5"/>',
            '<text x="200" y="390" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="', verdictColor, '">',
              badge,
            '</text>',

            // Footer
            '<line x1="40" y1="420" x2="360" y2="420" stroke="white" stroke-width="0.5" opacity="0.1"/>',
            '<text x="40" y="446" font-family="monospace" font-size="9" fill="white" opacity="0.3">ROUND #',
              _uint2str(b.roundId),
            '</text>',
            '<text x="360" y="446" text-anchor="end" font-family="monospace" font-size="9" fill="white" opacity="0.3">',
              addrShort,
            '</text>',
            '<text x="200" y="480" text-anchor="middle" font-family="monospace" font-size="9" fill="white" opacity="0.2">SETTLED ON MANTLE NETWORK</text>',
            '<text x="200" y="498" text-anchor="middle" font-family="monospace" font-size="8" fill="', verdictColor, '" opacity="0.4">klyro.xyz</text>',

            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name":"Klyro Battle #', _uint2str(tokenId),
            '","description":"On-chain duel record. Human vs Axiom-7 AI on Mantle Network.",',
            '"attributes":[',
              '{"trait_type":"Verdict","value":"', verdictLabel, '"},',
              '{"trait_type":"Strategy","value":"', strategyType, '"},',
              '{"trait_type":"Badge","value":"', badge, '"},',
              '{"trait_type":"Human Call","value":"', (b.humanCall ? "UP" : "DOWN"), '"},',
              '{"trait_type":"Outcome","value":"', (b.outcome ? "UP" : "DOWN"), '"},',
              '{"trait_type":"Round","value":', _uint2str(b.roundId), '}',
            '],',
            '"image":"data:image/svg+xml;base64,', _b64(bytes(svg)), '"}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", _b64(bytes(json))));
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v; uint256 len;
        while (tmp != 0) { len++; tmp /= 10; }
        bytes memory b = new bytes(len);
        while (v != 0) { b[--len] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(b);
    }

    function _addrShort(address a) internal pure returns (string memory) {
        bytes memory full = abi.encodePacked(a);
        return string(abi.encodePacked(
            "0x",
            _hexNibble(uint8(full[0]) >> 4),  _hexNibble(uint8(full[0]) & 0xf),
            _hexNibble(uint8(full[1]) >> 4),  _hexNibble(uint8(full[1]) & 0xf),
            "...",
            _hexNibble(uint8(full[18]) >> 4), _hexNibble(uint8(full[18]) & 0xf),
            _hexNibble(uint8(full[19]) >> 4), _hexNibble(uint8(full[19]) & 0xf)
        ));
    }

    function _hexNibble(uint8 n) internal pure returns (bytes1) {
        return n < 10 ? bytes1(n + 48) : bytes1(n + 87);
    }

    function _b64(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(encodedLen);
        bytes memory tableBytes = bytes(table);
        uint256 i; uint256 j;
        for (; i + 3 <= data.length; i += 3) {
            uint24 triple = uint24(uint8(data[i])) << 16
                          | uint24(uint8(data[i+1])) << 8
                          | uint24(uint8(data[i+2]));
            result[j++] = tableBytes[(triple >> 18) & 63];
            result[j++] = tableBytes[(triple >> 12) & 63];
            result[j++] = tableBytes[(triple >> 6)  & 63];
            result[j++] = tableBytes[triple & 63];
        }
        if (data.length - i == 2) {
            uint24 triple = uint24(uint8(data[i])) << 16 | uint24(uint8(data[i+1])) << 8;
            result[j++] = tableBytes[(triple >> 18) & 63];
            result[j++] = tableBytes[(triple >> 12) & 63];
            result[j++] = tableBytes[(triple >> 6)  & 63];
            result[j++] = "=";
        } else if (data.length - i == 1) {
            uint24 triple = uint24(uint8(data[i])) << 16;
            result[j++] = tableBytes[(triple >> 18) & 63];
            result[j++] = tableBytes[(triple >> 12) & 63];
            result[j++] = "=";
            result[j++] = "=";
        }
        return string(result);
    }
}

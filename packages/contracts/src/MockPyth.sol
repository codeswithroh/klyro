// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPyth.sol";

/**
 * @notice Drop-in IPyth replacement for Mantle Sepolia.
 *
 * The canonical Pyth contract on Mantle Sepolia (0x98046Bd...) is the old
 * Wormhole-based v32 implementation. Pyth Hermes now exclusively emits the
 * newer accumulator format (PNAU / 0x504e415501) which that contract cannot
 * parse — updatePriceFeeds reverts silently. There is no active price pusher
 * either, so the stored price is days stale.
 *
 * This contract accepts a simple custom encoding instead:
 *   updateData[i] = abi.encode(bytes32 feedId, int64 price, uint64 conf, int32 expo)
 *
 * The frontend fetches live prices from Pyth Hermes REST (rawPrice + expo),
 * encodes them in the format above, and calls openRoundWithPrice / resolveRoundWithPrice.
 * The encoding is done in useOpenRound / useResolveRound with viem encodeAbiParameters.
 *
 * getUpdateFee returns 0 — no ETH required.
 */
contract MockPyth is IPyth {

    struct StoredPrice {
        int64  price;
        uint64 conf;
        int32  expo;
        uint64 publishTime;
    }

    mapping(bytes32 => StoredPrice) private _prices;

    // ── IPyth ────────────────────────────────────────────────────────────────

    function updatePriceFeeds(bytes[] calldata updateData) external payable override {
        for (uint256 i = 0; i < updateData.length; i++) {
            (bytes32 id, int64 price, uint64 conf, int32 expo) =
                abi.decode(updateData[i], (bytes32, int64, uint64, int32));
            _prices[id] = StoredPrice(price, conf, expo, uint64(block.timestamp));
        }
    }

    function getUpdateFee(bytes[] calldata) external pure override returns (uint256) {
        return 0;
    }

    function getPriceNoOlderThan(bytes32 id, uint256 age) external view override returns (PythPrice memory) {
        StoredPrice storage p = _prices[id];
        require(p.publishTime > 0,                             "MockPyth: no price");
        require(block.timestamp - p.publishTime <= age,        "MockPyth: price stale");
        return PythPrice(p.price, p.conf, p.expo, p.publishTime);
    }

    function getPriceUnsafe(bytes32 id) external view returns (PythPrice memory) {
        StoredPrice storage p = _prices[id];
        return PythPrice(p.price, p.conf, p.expo, p.publishTime);
    }
}

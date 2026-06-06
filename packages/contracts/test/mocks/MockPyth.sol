// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../src/interfaces/IPyth.sol";

/// @notice Minimal Pyth mock for tests. Allows setting arbitrary prices per feed.
contract MockPyth is IPyth {
    mapping(bytes32 => PythPrice) private _prices;
    uint256 public updateFee = 1;

    function setPrice(bytes32 feedId, int64 price, uint64 conf, int32 expo) external {
        _prices[feedId] = PythPrice({ price: price, conf: conf, expo: expo, publishTime: block.timestamp });
    }

    function setPublishTime(bytes32 feedId, uint256 t) external {
        _prices[feedId].publishTime = t;
    }

    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (PythPrice memory) {
        PythPrice memory p = _prices[id];
        require(block.timestamp - p.publishTime <= age, "MockPyth: price too old");
        return p;
    }

    function updatePriceFeeds(bytes[] calldata) external payable {}

    function getUpdateFee(bytes[] calldata) external view returns (uint256) {
        return updateFee;
    }
}

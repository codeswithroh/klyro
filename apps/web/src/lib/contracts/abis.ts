// ABI stubs — replace with generated ABIs after `forge build`
// TODO (Phase A): run `forge build` in packages/contracts and copy ABIs here

export const ROUND_MANAGER_ABI = [
  {
    name: 'openRound',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'asset', type: 'bytes32' }, { name: 'durationSeconds', type: 'uint256' }],
    outputs: [{ name: 'roundId', type: 'uint256' }],
  },
  {
    name: 'lockPrediction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roundId', type: 'uint256' }, { name: 'isUp', type: 'bool' }],
    outputs: [],
  },
  {
    name: 'resolveRound',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roundId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getRound',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'roundId', type: 'uint256' }],
    outputs: [
      { name: 'asset', type: 'bytes32' },
      { name: 'startPrice', type: 'int64' },
      { name: 'closePrice', type: 'int64' },
      { name: 'startTime', type: 'uint256' },
      { name: 'closeTime', type: 'uint256' },
      { name: 'resolved', type: 'bool' },
      { name: 'outcome', type: 'bool' },
    ],
  },
  {
    name: 'RoundOpened',
    type: 'event',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true },
      { name: 'asset', type: 'bytes32', indexed: false },
      { name: 'startPrice', type: 'int64', indexed: false },
      { name: 'startTime', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PredictionLocked',
    type: 'event',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'isUp', type: 'bool', indexed: false },
    ],
  },
  {
    name: 'RoundResolved',
    type: 'event',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true },
      { name: 'closePrice', type: 'int64', indexed: false },
      { name: 'outcome', type: 'bool', indexed: false },
    ],
  },
] as const

export const LEADERBOARD_ABI = [
  {
    name: 'getTopPlayers',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [
      { name: 'players', type: 'address[]' },
      { name: 'points', type: 'uint256[]' },
      { name: 'wins', type: 'uint256[]' },
      { name: 'losses', type: 'uint256[]' },
    ],
  },
] as const

export const AGENT_REGISTRY_ABI = [
  {
    name: 'getAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'bytes32' }],
    outputs: [
      { name: 'wallet', type: 'address' },
      { name: 'identityId', type: 'bytes32' },
      { name: 'wins', type: 'uint256' },
      { name: 'losses', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'bytes32' },
      { name: 'wallet', type: 'address' },
      { name: 'identityId', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

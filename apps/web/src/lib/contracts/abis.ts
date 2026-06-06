// ABIs for all Klyro contracts.
// Generated from `forge build` output — update after any contract change.

export const ROUND_MANAGER_ABI = [
  {
    name: 'openRound',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs:  [{ name: 'priceFeedId', type: 'bytes32' }, { name: 'durationSeconds', type: 'uint256' }],
    outputs: [{ name: 'roundId', type: 'uint256' }],
  },
  {
    name: 'lockPrediction',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs:  [{ name: 'roundId', type: 'uint256' }, { name: 'isUp', type: 'bool' }],
    outputs: [],
  },
  {
    name: 'resolveRound',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs:  [{ name: 'roundId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getRound',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [{ name: 'roundId', type: 'uint256' }],
    outputs: [
      { name: 'priceFeedId', type: 'bytes32' },
      { name: 'startPrice',  type: 'int64'   },
      { name: 'closePrice',  type: 'int64'   },
      { name: 'startTime',   type: 'uint64'  },
      { name: 'closeTime',   type: 'uint64'  },
      { name: 'resolved',    type: 'bool'    },
      { name: 'outcome',     type: 'bool'    },
    ],
  },
  {
    name: 'isRoundOpen',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [{ name: 'roundId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'nextRoundId',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'RoundOpened',
    type: 'event' as const,
    inputs: [
      { name: 'roundId',     type: 'uint256', indexed: true  },
      { name: 'priceFeedId', type: 'bytes32', indexed: false },
      { name: 'startPrice',  type: 'int64',   indexed: false },
      { name: 'startTime',   type: 'uint64',  indexed: false },
      { name: 'closeTime',   type: 'uint64',  indexed: false },
    ],
  },
  {
    name: 'PredictionLocked',
    type: 'event' as const,
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true  },
      { name: 'player',  type: 'address', indexed: true  },
      { name: 'isUp',    type: 'bool',    indexed: false },
    ],
  },
  {
    name: 'RoundResolved',
    type: 'event' as const,
    inputs: [
      { name: 'roundId',    type: 'uint256', indexed: true  },
      { name: 'closePrice', type: 'int64',   indexed: false },
      { name: 'outcome',    type: 'bool',    indexed: false },
    ],
  },
] as const

export const PREDICTION_REGISTRY_ABI = [
  {
    name: 'hasPredicted',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [{ name: 'roundId', type: 'uint256' }, { name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'prediction',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [{ name: 'roundId', type: 'uint256' }, { name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getPlayerCount',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [{ name: 'roundId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const LEADERBOARD_ABI = [
  {
    name: 'getPlayer',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'points',    type: 'uint256' },
      { name: 'wins',      type: 'uint256' },
      { name: 'losses',    type: 'uint256' },
      { name: 'streak',    type: 'uint256' },
      { name: 'bestStreak',type: 'uint256' },
    ],
  },
  {
    name: 'getAccuracy',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [{ name: 'player', type: 'address' }],
    outputs: [{ name: 'bps', type: 'uint256' }],
  },
  {
    name: 'getAllPlayers',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'totalPlayers',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const AGENT_REGISTRY_ABI = [
  {
    name: 'getAgent',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [{ name: 'agentId', type: 'bytes32' }],
    outputs: [
      { name: 'wallet',           type: 'address' },
      { name: 'erc8004IdentityId',type: 'bytes32' },
      { name: 'name',             type: 'string'  },
      { name: 'active',           type: 'bool'    },
    ],
  },
  {
    name: 'registerAgent',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'agentId',          type: 'bytes32' },
      { name: 'wallet',           type: 'address' },
      { name: 'erc8004IdentityId',type: 'bytes32' },
      { name: 'name',             type: 'string'  },
    ],
    outputs: [],
  },
  {
    name: 'isActiveAgent',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getAllAgentIds',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs:  [],
    outputs: [{ name: '', type: 'bytes32[]' }],
  },
] as const

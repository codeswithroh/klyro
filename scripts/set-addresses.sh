#!/usr/bin/env bash
# Usage: ./scripts/set-addresses.sh <PredictionRegistry> <Leaderboard> <RoundManager> <AgentRegistry>
# Patches all env files with deployed contract addresses.

set -euo pipefail

PRED_REG=$1
LEADERBOARD=$2
ROUND_MGR=$3
AGENT_REG=$4

echo "Patching apps/web/.env.local ..."
sed -i '' "s|NEXT_PUBLIC_PREDICTION_REGISTRY_ADDRESS=.*|NEXT_PUBLIC_PREDICTION_REGISTRY_ADDRESS=$PRED_REG|" apps/web/.env.local
sed -i '' "s|NEXT_PUBLIC_LEADERBOARD_ADDRESS=.*|NEXT_PUBLIC_LEADERBOARD_ADDRESS=$LEADERBOARD|" apps/web/.env.local
sed -i '' "s|NEXT_PUBLIC_ROUND_MANAGER_ADDRESS=.*|NEXT_PUBLIC_ROUND_MANAGER_ADDRESS=$ROUND_MGR|" apps/web/.env.local
sed -i '' "s|NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=.*|NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=$AGENT_REG|" apps/web/.env.local

echo "Patching packages/bot/.env ..."
sed -i '' "s|ROUND_MANAGER_ADDRESS=.*|ROUND_MANAGER_ADDRESS=$ROUND_MGR|" packages/bot/.env
sed -i '' "s|AGENT_REGISTRY_ADDRESS=.*|AGENT_REGISTRY_ADDRESS=$AGENT_REG|" packages/bot/.env

echo "Patching packages/contracts/.env ..."
# Store for PostDeploy script reference
cat >> packages/contracts/.env <<EOF

# Deployed addresses ($(date -u +%Y-%m-%dT%H:%M:%SZ))
PREDICTION_REGISTRY_ADDRESS=$PRED_REG
LEADERBOARD_ADDRESS=$LEADERBOARD
ROUND_MANAGER_ADDRESS=$ROUND_MGR
AGENT_REGISTRY_ADDRESS=$AGENT_REG
BOT_WALLET_ADDRESS=0xC557BBc3351B1CcbbDa556b8001736beb28A7A0B
EOF

echo ""
echo "✓ All env files patched."
echo "Next steps:"
echo "  1. Run: cd packages/contracts && forge script script/PostDeploy.s.sol --rpc-url mantle_sepolia --broadcast"
echo "  2. Run: pnpm install && pnpm --filter bot dev"
echo "  3. Run: pnpm dev"

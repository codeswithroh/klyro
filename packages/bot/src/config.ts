import 'dotenv/config'

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

export const config = {
  rpcUrl:              process.env.MANTLE_SEPOLIA_RPC ?? 'https://rpc.sepolia.mantle.xyz',
  botPrivateKey:       required('BOT_PRIVATE_KEY') as `0x${string}`,
  roundManagerAddress: required('ROUND_MANAGER_ADDRESS') as `0x${string}`,
  agentRegistryAddress:required('AGENT_REGISTRY_ADDRESS') as `0x${string}`,
  submitBufferSeconds: parseInt(process.env.BOT_SUBMIT_BUFFER_SECONDS ?? '10', 10),
}

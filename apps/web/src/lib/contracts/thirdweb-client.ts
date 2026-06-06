import { createThirdwebClient } from 'thirdweb'

if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
  throw new Error('NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set')
}

export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
})

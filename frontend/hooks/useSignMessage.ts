import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {useAuthorization} from '../components/providers/AuthorizationProvider';

export const useSolanaMessageSigner = () => {
  const {authorizeSession} = useAuthorization();

  const signMessage = async (message: string): Promise<Uint8Array> => {
    const messageBuffer = new TextEncoder().encode(message);

    const signature = await transact(async (wallet: Web3MobileWallet) => {
      const authorizationResult = await authorizeSession(wallet);

      const signedMessages = await wallet.signMessages({
        addresses: [authorizationResult.address],
        payloads: [messageBuffer],
      });

      return signedMessages[0];
    });

    return signature;
  };

  return {signMessage};
};

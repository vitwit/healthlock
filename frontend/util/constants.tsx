import {PublicKey} from '@solana/web3.js';

export const TEE_STATE = Buffer.from('state');
export const PROGRAM_ID = new PublicKey(
  '8zjg3UihgxJ3H8AtWfLdGkfBGauVyvJHAQaKW8v1y4Mj',
);
export const IPFS_URL = 'https://vv7mcklb-5001.inc1.devtunnels.ms/api/v0/add';

export const ERR_UNKNOWN = 'Something went wrong. Please try again';

export const SOLANA_VALIDATOR = 'https://api.devnet.solana.com';
// export const SOLANA_VALIDATOR = 'https://40v82shj-8899.inc1.devtunnels.ms/';

export const REST_ENDPOINT =
  'https://healthlock.conspulse.com/tee/download-record';

// export const REST_ENDPOINT = 'https://40v82shj-8085.inc1.devtunnels.ms/download-record';

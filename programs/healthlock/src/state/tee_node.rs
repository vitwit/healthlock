use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TEEState {
    pub signer: Pubkey,
    #[max_len(512)]
    pub pubkey: Vec<u8>,
    #[max_len(512)]
    pub attestation: Vec<u8>,
    pub is_initialized: bool,
}

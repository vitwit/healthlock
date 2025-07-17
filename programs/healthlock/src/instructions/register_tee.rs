use anchor_lang::prelude::*;
use crate::{error::ErrorCode, state::TEEState, ANCHOR_DESCRIMINATOR_SIZE};


pub fn register_tee_node(ctx: Context<RegisterTEENode>, pubkey: Vec<u8>, attestation: Vec<u8>) -> Result<()> {
    let state = &mut ctx.accounts.state;

    if state.is_initialized {
        return Err(ErrorCode::NodeAlreadyRegistered.into());
    }

    state.signer = *ctx.accounts.signer.key;
    state.pubkey = pubkey;
    state.attestation = attestation;
    state.is_initialized = true;

    Ok(())
}

#[derive(Accounts)]
#[instruction(pubkey: Pubkey)]
pub struct RegisterTEENode<'info> {
    #[account(
        init,
        payer = signer,
        space = ANCHOR_DESCRIMINATOR_SIZE + TEEState::INIT_SPACE,
        seeds = [b"state", signer.key().as_ref()],
        bump
    )]
    pub state: Account<'info, TEEState>,

    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

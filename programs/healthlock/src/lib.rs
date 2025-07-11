use anchor_lang::prelude::*;

declare_id!("BD5UPzmwnKQ8oAhDaViS9dXopBf5wVZ57RAngCtwEdkQ");

#[program]
pub mod healthlock {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct OrganizationCounter {
    pub organization_id: u64,
}


#[account]
#[derive(InitSpace)]
pub struct Organization {
    pub owner: Pubkey,
    pub organization_id: u64,
    #[max_len(100)]
    pub name: String,
    #[max_len(200)]
    pub contact_info: String,
    pub created_at: i64,
    pub is_active: bool,
}
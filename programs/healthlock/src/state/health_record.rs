use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct HealthRecord {
    pub owner: Pubkey,
    pub record_id: u64,
    #[max_len(1000)]
    pub encrypted_data: Vec<u8>,
    pub created_at: i64,
    #[max_len(100)]
    pub access_list: Vec<AccessPermission>,
    #[max_len(100)]
    pub mime_type: String,
    pub file_size: u64,
    #[max_len(100)]
    pub description: String,
    #[max_len(50)]
    pub title: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct AccessPermission {
    pub organization: Pubkey,
    pub granted_at: i64,
}

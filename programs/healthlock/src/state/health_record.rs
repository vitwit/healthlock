use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct HealthRecord {
    pub owner: Pubkey,
    pub record_id: u64,
    #[max_len(1000)]
    pub encrypted_data: Vec<u8>,
    pub metadata: RecordMetadata,
    pub created_at: i64,
    #[max_len(100)]
    pub access_list: Vec<AccessPermission>,
    pub is_active: bool,
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RecordMetadata {
    #[max_len(100)]
    pub file_type: String,
    pub file_size: u64,
    #[max_len(100)]
    pub description: String,
    pub created_at: i64
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct AccessPermission {
    pub organization: Pubkey,    
    pub granted_at: i64,
    pub expires_at: Option<i64>,
    pub is_active: bool, 
}

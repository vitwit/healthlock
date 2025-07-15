use anchor_lang::prelude::*;

#[event]
pub struct UserRegistered {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub timestamp: i64,
}


#[event]
pub struct HealthRecordUploaded {
    pub owner: Pubkey,
    pub record_id: String,
    pub record_account: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AccessGranted {
    pub record_owner: Pubkey,
    pub record_id: String,
    pub organization: Pubkey,
    pub expires_at: Option<i64>,
    pub timestamp: i64,
}

#[event]
pub struct AccessRevoked {
    pub record_owner: Pubkey,
    pub record_id: String,
    pub organization: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct HealthRecordRetrieved {
    pub record_owner: Pubkey,
    pub record_id: String,
    pub requester: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct HealthRecordDeactivated {
    pub owner: Pubkey,
    pub record_id: String,
    pub timestamp: i64,
}

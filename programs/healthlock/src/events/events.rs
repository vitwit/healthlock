use anchor_lang::prelude::*;


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
    pub organization_name: String,
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

#[event]
pub struct OrganizationRegistered {
    pub owner: Pubkey,
    pub organization_account: Pubkey,
    pub name: String,
    pub timestamp: i64,
}
use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Record size exceeds maximum allowed size")]
    RecordTooLarge,
    #[msg("Description is too long")]
    DescriptionTooLong,
    #[msg("File type is too long")]
    FileTypeTooLong,
    #[msg("Access already granted to this organization")]
    AccessAlreadyGranted,
    #[msg("Access not found for this organization")]
    AccessNotFound,
    #[msg("Unauthorized access to this resource")]
    UnauthorizedAccess,
    #[msg("User vault is deactivated")]
    VaultDeactivated,
    #[msg("Health record is deactivated")]
    RecordDeactivated,
    #[msg("Health record is already deactivated")]
    RecordAlreadyDeactivated,
    #[msg("Maximum number of records reached")]
    MaxRecordsReached,
    #[msg("Maximum number of access permissions reached")]
    MaxAccessReached,
    #[msg("Invalid record ID")]
    InvalidRecordId,
    #[msg("organization name is too long")]
    NameTooLong,
    #[msg("organization contact info is too long")]
    ContactInfoTooLong,
    #[msg("Organization is deactivated")]
    OrganizationDeactivated,
    #[msg("Invalid organization")]
    InvalidOrganization,
}
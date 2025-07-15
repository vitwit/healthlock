use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Record size exceeds maximum allowed size")]
    RecordTooLarge,
    #[msg("Description is too long")]
    DescriptionTooLong,
    #[msg("File type is too long")]
    FileTypeTooLong,
}
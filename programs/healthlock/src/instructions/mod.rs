pub mod register_user;
pub use register_user::*;

pub mod init_records;
pub use init_records::*;

pub mod upload_health_record;
pub use upload_health_record::*;

pub mod grant_access;
pub use grant_access::*;

pub mod revoke_access;
pub use revoke_access::*;

pub mod update_user_vault;
pub use update_user_vault::*;

pub mod deactivate_record;
pub use deactivate_record::*;
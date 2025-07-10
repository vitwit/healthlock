# HealthLock - Secure Health Records on Solana
## 🎯 Goal
A decentralized health records management system where users store encrypted health records on-chain with TEE-based encryption/decryption and maintain full control over access and sharing.

## 🧑‍💻 User Flow

### 1. Home Screen
- View **“Register”** button for new users
  - call-to-action: **“Register User”**
- For registered users:
  - View **“Upload Health Record”** button
  - View list of previously uploaded health records
  - Each record shows:
    - File name / description  
    - Upload timestamp   
    - **Share** icon/button to grant access
  - Call-to-action: **“Upload Health Record”**

### 2. Register
- Connect wallet (via Solana Mobile Wallet Adapter)
- Create user health vault account on-chain (register user’s public key)
- Confirmation screen: _"Registration Successful"

### 3. Upload Health Record
- Select health document type (e.g., PDF, image, JSON, etc.)
- Data encrypted locally inside **TEE**
- Encrypted blob with timestamp and access control list will be stored on chain
- Confirmation message + record listed in user's dashboard

### 4. View Records
- View list of all uploaded records
- User can filter records by type or date
- Each entry includes:
  - Record name
  - Description
  - Timestamp   
  - Share icon to manage permissions  
- Decrypted data rendered securely on mobile

### 5. Share Record
- Click on **“Share”** icon next to a record
- Choose organization from list or add new
- Enter recipient’s wallet address
- Smart contract updates access control list
- Recipient gets notified and can decrypt inside their TEE

---

## 🔄 System Flow

### 1. **Encrypt Health Record**
- User sends health record to TEE enclave
- TEE encrypts the record with user's key
- Encrypted data returned to user

### 2. **Store on Blockchain**
- User submits encrypted health record to smart contract
- Contract stores encrypted data on Solana
- User record will be PDA with seeds ["user", userAddr, recordID]

### 3. **Retrieve Health Record**
- User requests their health record from contract
- Contract returns encrypted data to user
- User sends encrypted data to TEE enclave
- TEE decrypts and returns readable record

### 4. **Share with Organizations**
- User grants access permission to organization
- Organization can retrieve encrypted record from contract
- Organization uses TEE to decrypt (with user's permission)
- Access is logged and can be revoked anytime

---

## 🛠️ Smart Contract Requirements

### User Account Management
- Create user health vault account on chain
- Initialize the record counter
- Store user's public key and user metadata
- Track total records stored per user

### Upload Health Record
  - **Option 1: Store Health Record On Chain**
    - Store encrypted health record data on-chain  
    - Each record has unique ID and metadata  
    - Store record info: category, date, file type, size, access list of organisations  
    - Link all records to user account  
  
  - **Option 2: Store Health Record On Metaplex**
    - Create Metaplex NFT for each health record  
    - Store encrypted health record data on Metaplex (Arweave/IPFS)  
    - Each record has unique ID and metadata  
    - Store record info: category, date, file type, size, access list of organisations  
    - Store NFT mint address and Metaplex URI  
    - Link all records to user account  

### Access Control System
- Grant access permissions to organizations
- Optional: Set time-limited access (24hrs, 7days, 30days)
- Allow users to revoke access anytime

### Data Retrieval
- Return encrypted records to authorized users
- Verify user ownership before retrieval
- Check organization permissions before sharing

---

## 🔒 Security Requirements

### TEE Enclave Setup
- Deploy secure enclave for encryption/decryption
- User key management within TEE
- Set up attestation verification
- Implement methods for encryption and decryption of user health records.

### TEE Integration
- Secure communication channel with TEE enclave
- Verify TEE attestation before operations
- Encrypted data processing only in TEE

### Access Control
- Only record owner(user) can grant/revoke permissions
- Validate permissions before any data access
- Time-based expiration for organization access

---

## 🧪 Test Requirements

### Core Functionality Tests
- TEE encryption/decryption workflow
- Health record storage and retrieval
- Access permission granting/revoking
- User account management
- Organization access validation

### Security Tests
- TEE attestation verification
- Unauthorized access prevention

### Integration Tests
- End-to-end encrypt-store-retrieve flow
- Multi-organization sharing scenarios
- TEE-blockchain communication

---

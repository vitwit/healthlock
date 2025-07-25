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
Data encrypted locally inside a ***TEE***
- Encrypted data is stored on to the IPFS
- CID and access control list are  stored on chain
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
- Choose organization from list 
- Smart contract updates access control list
- Organization accesses the record, decrypted inside the TEE


---

## 🔄 System Flow

### 1. **Encrypt Health Record**
- User sends health record to TEE enclave
- TEE encrypts the record with its public key and returns the encrypted data
- The encrypted data is sent to IPFS, which returns the CID

### 2. **Store on Blockchain**
- User submits CID to smart contract
- Contract stores CID on Solana
- User record is stored in a PDA with seeds ["user", userAddr, recordID]

### 3. **Retrieve Health Record**
- User requests their health record from contract
- Contract returns CID to user and then
the data is fetched from the IPFS 
- Encrypted data is returned from the IPFS

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
  - **Store Health Record On Chain**
    - Store CID of the encrypted data  on-chain  
    - Each record has unique ID and metadata  
    - Store record info: category, date, file type, size, access list of organisations  
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


### Public IPFS (Storage)
- IPFS stores the data which is encrypted by the TEE

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

## 🚀 How to Run Locally

### 📦 Clone the Repository

```bash
git clone https://github.com/vitwit/healthlock.git
cd healthlock
```

---

### ✅ Requirements

Ensure the following tools are installed:

- [Rust](https://www.rust-lang.org/tools/install)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://www.anchor-lang.com/docs/installation)
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [React Native CLI](https://reactnative.dev/docs/environment-setup)
- [Android Studio](https://developer.android.com/studio)

---

## ⚙️ Running the Project

### 1. Start Local Solana Test Validator

```bash
solana-test-validator
```

Leave this running in a terminal.

---

### 2. Build & Deploy the Solana Program

```bash
anchor build
anchor deploy
```

---

### 3. Initialize On-Chain Record Counter

```bash
npx ts-node client/client.ts
```

Make sure your local wallet is configured and funded:

```bash
solana config set --url http://127.0.0.1:8899
solana airdrop 2
```

---

### 4. Build & Run the TEE Client

```bash
cd tee-client
make build
./tee-client start --config example.config.toml
```

This will start the simulated Trusted Execution Environment (TEE) server.

> 🧠 Leave this running in the background as it handles encryption/decryption.

---

### 5. Run the Frontend (React Native)

In a new terminal window:

```bash
cd frontend
npm install
npm run start
```

> Make sure an Android emulator is running, or your phone is connected via USB with USB debugging enabled.

---

## 🧪 Testing the App

Once the frontend launches:

- Tap **Register** to create your on-chain vault.
- Upload encrypted health records (stored on IPFS).
- View your uploaded records.
- Share with organizations securely via smart contract-based access control.

---

## 🛡️ Security Model

- Health data is encrypted within a Trusted Execution Environment (TEE).
- Only users have decryption keys — even the TEE provider cannot access raw data.
- IPFS is used to store the encrypted records off-chain.
- On-chain smart contracts store metadata and access permissions.
- Organizations must register and be granted permission to access records.

---

## 🧠 Architecture Overview

- `programs/` - Anchor-based Solana smart contracts.
- `client/` - Script to initialize on-chain state.
- `tee-client/` - Simulated Trusted Execution Environment.
- `frontend/` - React Native app to interact with the system.

---
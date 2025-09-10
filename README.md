# 🔒 AuthentiChain: Blockchain-Powered Counterfeit Detection and Refund System

Welcome to AuthentiChain, a Web3 solution built on the Stacks blockchain using Clarity smart contracts! This project tackles the massive real-world problem of counterfeit goods, which cost global economies over $500 billion annually by eroding consumer trust, harming brands, and enabling fraud in supply chains and e-commerce. AuthentiChain uses blockchain for transparent product tracking, authenticity verification, and automatic refunds—ensuring buyers get their money back instantly if a product is detected as counterfeit, all without intermediaries.

## ✨ Features

🛡️ Register products with unique authenticity hashes for immutable proof  
🔄 Track supply chain ownership transfers to prevent tampering  
💰 Secure escrow for payments, released only on successful verification  
🤖 Integrate with oracles for real-time counterfeit detection (e.g., via AI scans or QR codes)  
🔄 Automatic refunds triggered by smart contracts if counterfeits are detected  
⚖️ Dispute resolution for contested claims  
📊 Audit logs for full transparency and compliance  
👥 User roles for buyers, sellers, and verifiers  
💸 Native token support for seamless payments and refunds  

## 🛠 How It Works

AuthentiChain leverages 8 Clarity smart contracts to create a decentralized ecosystem for product authenticity. Sellers register genuine products on the blockchain, buyers pay into escrow, and upon delivery, verification occurs. If counterfeit, refunds are automatic. All interactions are trustless and auditable.

### Smart Contracts Overview

1. **AuthenticityRegistry.clar**: Registers products with a unique hash (e.g., from serial numbers, images, or metadata) and timestamps them immutably. Prevents duplicates and stores initial owner details.  
2. **SupplyChainTracker.clar**: Handles ownership transfers along the supply chain, logging each step to ensure no unauthorized alterations.  
3. **EscrowManager.clar**: Locks buyer funds in escrow during purchase, releasing to seller only after successful verification.  
4. **VerificationOracle.clar**: Interfaces with external oracles (e.g., AI tools or trusted verifiers) to input detection results, triggering events based on authenticity checks.  
5. **RefundProcessor.clar**: Automatically executes refunds from escrow if counterfeit is confirmed, transferring funds back to the buyer.  
6. **UserAuthentication.clar**: Manages user registrations, roles (buyer/seller/verifier), and permissions to interact with the system.  
7. **DisputeHandler.clar**: Allows escalation of verification disputes, with voting or arbitrator resolution to override oracle decisions.  
8. **AuditLogger.clar**: Records all transactions, verifications, and refunds for immutable auditing and compliance reporting.  

### For Sellers

- Generate a unique hash of your product (e.g., SHA-256 of serial + image).  
- Call `register-product` in AuthenticityRegistry with the hash, description, and metadata.  
- Use SupplyChainTracker to log transfers as the product moves through the chain.  
- When selling, initiate escrow via EscrowManager.  

Your product is now traceable and protected—buyers can verify authenticity anytime!

### For Buyers

- Search for products via registry queries.  
- Pay into EscrowManager for secure holding.  
- Upon receipt, scan/verify using an oracle-integrated app (e.g., QR code).  
- Call `verify-product` in VerificationOracle with the product ID and detection data.  
- If authentic, funds release to seller. If counterfeit, RefundProcessor auto-refunds you.  

Instant peace of mind—no more buyer's remorse!

### For Verifiers/Oracles

- Register via UserAuthentication.  
- Submit detection results to VerificationOracle (e.g., "counterfeit: true/false").  
- Use DisputeHandler if results are challenged.  

All actions are logged in AuditLogger for transparency.

## 🚀 Getting Started

1. Set up a Stacks wallet and deploy the Clarity contracts using the Stacks CLI.  
2. Interact via the Stacks Explorer or build a frontend dApp.  
3. Test with sample hashes and mock oracles for end-to-end flows.  

This project empowers fair trade in a counterfeit-plagued world—join the revolution! 🚀
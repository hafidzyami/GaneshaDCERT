# System Architecture Description

## Overview
A hybrid blockchain-RDBMS architecture that combines blockchain immutability with PostgreSQL's high-performance query capabilities for Verifiable Credential schema management.

## Components

### 1. User
- External actor who interacts with the system
- Makes API requests for read and write operations

### 2. API Layer
- Entry point for all user requests
- Routes requests to appropriate paths (Write or Read)
- RESTful API endpoints

### 3. Write Path
- Handles create, update, deactivate, and reactivate operations
- All write operations go directly to blockchain
- Ensures blockchain remains the single source of truth
- Creates immutable transaction records

### 4. Read Path
- Handles query operations for VC schemas
- Primary: Query PostgreSQL database (fast, ~50ms response time)
- Fallback: Query blockchain directly if data not found in database (~5s response time)
- Provides 100x faster read performance compared to blockchain

### 5. Blockchain (Source of Truth)
- Ethereum-compatible blockchain
- Stores VCManager smart contract
- Emits events for all state changes:
  - SchemaCreated
  - SchemaUpdated
  - SchemaDeactivated
  - SchemaReactivated
- Immutable and tamper-proof
- Single source of truth for all VC schemas

### 6. Event Sync Layer
- Consists of two main components:
  - **Listener**: Monitors blockchain for new events
  - **Checkpoint**: Tracks synchronization progress
- Synchronizes data from blockchain to PostgreSQL
- Ensures eventual consistency
- Handles two-phase synchronization:
  - Historical catch-up (batch processing)
  - Real-time listening (immediate processing)

### 7. PostgreSQL (RDBMS)
- High-performance read layer
- Stores synchronized data in two main tables:
  - **VCSchema**: Stores all VC schema versions with composite key (id, version)
  - **EventCheckpoint**: Tracks last processed block number for recovery
- Indexed for fast queries on id, version, and isActive fields
- Provides ~100x faster read performance than blockchain
- Eventually consistent with blockchain

## Data Flow

### Write Operations
1. User sends write request to API Layer
2. API Layer routes to Write Path
3. Write Path submits transaction to Blockchain
4. Blockchain processes transaction and emits event
5. Event Sync Layer detects new event
6. Event Sync Layer updates PostgreSQL database
7. Checkpoint is updated for recovery purposes

### Read Operations
1. User sends read request to API Layer
2. API Layer routes to Read Path
3. Read Path queries PostgreSQL database first (primary)
4. If data found in PostgreSQL: Return result immediately (~50ms)
5. If data not found: Fallback to blockchain query (~5s)
6. Return result to user

## Key Features

### Consistency Model
- **Strong Consistency**: All writes go to blockchain (source of truth)
- **Eventual Consistency**: PostgreSQL eventually reflects blockchain state
- **Read-after-write**: May experience temporary inconsistency during sync

### Performance Optimization
- Database provides indexed reads (~100x faster than blockchain)
- Write operations maintain blockchain immutability
- Fallback mechanism ensures data availability

### Reliability
- Checkpoint-based recovery for sync failures
- Idempotent event processing (no duplicate processing)
- Automatic reconnection and resume from last checkpoint

### Event-Driven Architecture
- Blockchain events trigger database updates
- Asynchronous synchronization (non-blocking writes)
- Real-time listening for immediate updates after catch-up

## Architecture Patterns
- **CQRS (Command Query Responsibility Segregation)**: Separate write (blockchain) and read (database) paths
- **Event Sourcing**: Blockchain events as the source of state changes
- **Eventual Consistency**: Database syncs asynchronously from blockchain
- **Checkpoint/Resume**: Fault-tolerant synchronization with recovery mechanism

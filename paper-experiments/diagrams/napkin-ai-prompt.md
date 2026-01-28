# Napkin AI Prompt for System Architecture Diagram

## Prompt 1: Complete System Architecture

```
Create a system architecture diagram showing a hybrid blockchain-RDBMS architecture with the following components and flows:

Components:
1. User (actor icon)
2. API Layer (rectangle)
3. Write Path (rectangle, flows to blockchain)
4. Read Path (rectangle, flows to database with fallback to blockchain)
5. Blockchain labeled "Source of Truth" (cylinder/database shape)
6. Event Sync Layer containing "Listener" and "Checkpoint" (rectangle)
7. PostgreSQL RDBMS containing "VCSchema" and "EventCheckpoint" tables (cylinder/database shape)

Flow connections:
- User → API Layer: "API Request"
- API Layer → Write Path: "Write"
- API Layer → Read Path: "Read"
- Write Path → Blockchain: "Transaction"
- Blockchain → Event Sync Layer: "Events (Created, Updated, Deactivated, Reactivated)"
- Event Sync Layer → PostgreSQL: "Update"
- Read Path → PostgreSQL: "Query" (primary, solid line)
- Read Path → Blockchain: "Fallback" (secondary, dashed line)

Style: Professional, grayscale, suitable for IEEE conference paper, clean layout with vertical flow.
```

## Prompt 2: Simplified Version (Minimal)

```
Create a simple system architecture diagram with 7 components:

Left side: User connects to API Layer
Middle: API Layer splits into Write Path (goes to Blockchain) and Read Path (goes to PostgreSQL Database)
Right side: Blockchain emits events to Event Sync Layer, which updates PostgreSQL Database
Bottom: Read Path can fallback to Blockchain if needed (dashed line)

Components: User, API Layer, Write Path, Read Path, Blockchain (Source of Truth), Event Sync Layer, PostgreSQL Database

Use vertical flow, grayscale colors, professional style for academic paper.
```

## Prompt 3: Detailed with Annotations

```
Design a hybrid blockchain-database architecture diagram showing:

Top Layer: User → API Layer

Middle Layer (Split paths):
- Write Path: API → Blockchain (stores immutable data)
- Read Path: API → PostgreSQL Database (fast queries) with fallback to Blockchain

Bottom Layer:
- Blockchain emits events (SchemaCreated, SchemaUpdated, SchemaDeactivated, SchemaReactivated)
- Event Sync Layer (with Listener and Checkpoint components) processes events
- Events update PostgreSQL Database tables (VCSchema, EventCheckpoint)

Key characteristics:
- Blockchain = Source of Truth (immutable)
- PostgreSQL = Performance Layer (indexed reads)
- Event Sync = Consistency Bridge (eventual consistency)

Style: Clean, professional, grayscale, suitable for IEEE conference publication, vertical layout.
```

## Prompt 4: Focus on Data Flow

```
Create an architecture diagram illustrating:

Write Flow:
User → API → Write Path → Blockchain → Event Emission → Event Sync Layer → PostgreSQL Update

Read Flow (Dual Path):
User → API → Read Path → PostgreSQL (primary, fast)
User → API → Read Path → Blockchain (fallback, slower)

Components shown:
- User (actor)
- API Layer (gateway)
- Write Path & Read Path (separate processing)
- Blockchain (immutable source of truth)
- Event Sync Layer (synchronization bridge)
- PostgreSQL (indexed database with VCSchema and EventCheckpoint tables)

Visual emphasis on the separation of write (blockchain) and read (database) concerns. Grayscale, professional style.
```

## Tips for Using Napkin AI

1. **Start Simple**: Try Prompt 2 first for a basic layout, then refine
2. **Iterate**: Generate multiple versions and pick the best one
3. **Customize**: After generation, you can ask Napkin AI to adjust colors, layout, or add/remove elements
4. **Export**: Export as SVG or PNG for inclusion in your paper
5. **Refine Prompts**: If the result isn't quite right, add more specific details about:
   - Component positioning (vertical/horizontal flow)
   - Connection types (solid/dashed lines)
   - Level of detail (high-level vs detailed)

## Alternative Simplified Prompt

```
Show a system with 3 layers:
1. Top: User connects to API
2. Middle: API splits to Write Path (→ Blockchain) and Read Path (→ Database)
3. Bottom: Blockchain sends events to sync layer, sync layer updates Database

Blockchain is source of truth. Database is for fast reads. Event sync keeps them consistent.

Grayscale, professional, vertical layout.
```

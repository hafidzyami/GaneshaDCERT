# Diagram Captions

## Figure 1: System Architecture

**Caption:**
Figure 1. Hybrid Blockchain-RDBMS System Architecture. The architecture separates write operations (routed to blockchain for immutability) from read operations (served by PostgreSQL for performance). An event synchronization layer maintains eventual consistency between the blockchain source of truth and the indexed database, enabling fast queries while preserving blockchain integrity.

**Alternative (shorter):**
Figure 1. System Architecture showing the hybrid approach with blockchain as source of truth and PostgreSQL as performance layer. Event synchronization ensures data consistency between both systems.

---

## Figure 2: Event Synchronization Flow

**Caption:**
Figure 2. Event Synchronization Flow illustrating the two-phase synchronization mechanism. The Historical Catch-up phase processes missed events in batches of 1000 blocks from the last checkpoint, while the Real-time Listening phase continuously monitors and processes new blockchain events. Both phases implement idempotency checks and checkpoint-based recovery to ensure reliable data synchronization.

**Alternative (shorter):**
Figure 2. Event Synchronization Flow with checkpoint-based recovery. Historical catch-up processes past events in batches, while real-time listening handles new events as they occur.

---

## Figure 3: Event Synchronization Flow (Alternative Format)

**Caption:**
Figure 3. Detailed Event Synchronization Flow. The process begins with checkpoint retrieval, followed by historical catch-up to process missed events in 1000-block batches. After catching up, the system transitions to real-time listening mode, continuously monitoring blockchain events with built-in error recovery and idempotency guarantees.

---

## Usage Guidelines for IEEE Conference Paper

### Format:
- **Bold** for figure number: **Figure 1.**
- Regular text for caption
- Place caption **below** the figure
- Use period after "Figure X"

### Example in LaTeX:
```latex
\begin{figure}[htbp]
\centering
\includegraphics[width=0.48\textwidth]{system-architecture.png}
\caption{Hybrid Blockchain-RDBMS System Architecture showing separation of write (blockchain) and read (PostgreSQL) paths with event-driven synchronization.}
\label{fig:system-architecture}
\end{figure}
```

### Example in Word/Markdown:
```
![System Architecture](system-architecture.png)

**Figure 1.** Hybrid Blockchain-RDBMS System Architecture. The architecture separates write operations (routed to blockchain for immutability) from read operations (served by PostgreSQL for performance). An event synchronization layer maintains eventual consistency between the blockchain source of truth and the indexed database.
```

---

## Recommended Captions for Your Paper

### For System Architecture Diagram:
**Figure 1.** System architecture of the hybrid blockchain-RDBMS approach. Write operations are directed to the blockchain to ensure immutability, while read operations are served from PostgreSQL for high performance. The Event Sync Layer maintains data consistency through checkpoint-based synchronization.

### For Event Synchronization Flow Diagram:
**Figure 2.** Event synchronization workflow showing checkpoint-based recovery mechanism. The Historical Catch-up phase processes missed events in 1000-block batches, while Real-time Listening continuously monitors new blockchain events with idempotency checks and error recovery.

---

## Tips for Writing Good Captions

1. **Be concise but informative** - explain what the figure shows
2. **Highlight key elements** - mention important components or flows
3. **Use present tense** - "shows", "illustrates", "demonstrates"
4. **Avoid redundancy** - don't repeat what's already in the title
5. **Add context** - explain why this is important or how it works
6. **Keep it scannable** - readers often skim figures and captions

---

## Indonesian Version (if needed)

### Gambar 1: Arsitektur Sistem
**Gambar 1.** Arsitektur sistem hybrid blockchain-RDBMS. Operasi tulis diarahkan ke blockchain untuk menjamin immutability, sedangkan operasi baca dilayani dari PostgreSQL untuk performa tinggi. Event Sync Layer menjaga konsistensi data melalui mekanisme sinkronisasi berbasis checkpoint.

### Gambar 2: Alur Sinkronisasi Event
**Gambar 2.** Alur sinkronisasi event dengan mekanisme pemulihan berbasis checkpoint. Fase Historical Catch-up memproses event yang terlewat dalam batch 1000 blok, sedangkan Real-time Listening memantau event blockchain baru secara kontinyu dengan pengecekan idempotency dan pemulihan error.

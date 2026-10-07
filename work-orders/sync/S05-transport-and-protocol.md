# S05 — Transport and the sync protocol

State: Not started

## Goal

Paired devices open an encrypted connection and exchange the changes each is missing, then keep streaming new ones.

## Scope

- Mutual TLS 1.3 with pinned certificates (rustls), length-prefixed frames in a compact binary format, a hello with a protocol version and capabilities, then the summary, change, and stream phases from `docs/SYNC.md`.
- Reconnection with back-off, resuming from the per-peer cursor, and clean handling of a peer that disappears mid-transfer.
- Refusing unknown message types and newer protocol versions with a clear error.
- Validating every incoming change against size and shape limits before it is applied.
- Tests on localhost: three instances, edits while partitioned, then a heal; a large backlog; a malformed frame; a connection dropped half way.

## Done when

- Three instances converge after random edits and partitions, with the S03 merge rules. (Run and recorded.)
- Throughput and the time to catch up from empty are measured and written down.

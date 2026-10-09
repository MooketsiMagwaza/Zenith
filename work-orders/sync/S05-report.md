# S05 handoff and commit notes - 9 October 2026

Owner: Mooketsi Vincent Magwaza (sole founder). Branch: feat/sync-transport, baseline 5cfb33d. Work stayed in the standalone clone. No pushes, gh, history rewrites, attribution trailers, app/tool changes, committed keys/certificates/secrets or network workarounds.

Git refused .git/index.lock with Permission denied on the first green step. Further Git writes stopped. The requested .codex/commit-S05.txt also refused writes (Access denied); these notes are preserved here in the allowed work-orders directory. The assistant must commit the reviewed working tree.

## Green step 1

Command: cargo test -p zenith-sync --lib --offline. Result: 8 passed (2 inherited pairing, 6 transport), zero failed/ignored.

Intended commit: feat: add pinned TLS and bounded opaque sync protocol

Files: Cargo.lock; crates/zenith-sync/Cargo.toml; crates/zenith-sync/src/lib.rs; crates/zenith-sync/src/transport/mod.rs; crates/zenith-sync/src/transport/tls.rs; crates/zenith-sync/src/transport/codec.rs; crates/zenith-sync/src/transport/tests.rs; docs/SYNC.md; work-orders/sync/S05-transport-and-protocol.md. Later steps change some of these same files, so this boundary cannot be staged verbatim from the final tree without reconstructing the earlier snapshot. Do not invent a saved commit hash.

## Green step 2

Intended commit: test: verify localhost convergence and interrupted transfer recovery

Command: cargo test -p zenith-sync --test transport --offline -- --nocapture. Result: 4 passed, zero failed/ignored. Three ports carried real Automerge changes through three seeded edit/partition/heal rounds; records converged with deleted descendants hidden and session logs retained. A 400-change backlog was interrupted after at least 40 receipts, receiver reopened its identity/store and resumed; sender's durable cursor reopened at 400. A reconnect loop survived an unavailable port then synced after the listener returned.

Initial concurrent-suite performance sample (not the final sequential benchmark): 256 x 64 KiB = 16 MiB payload; TLS connection start through final durable sender acknowledgement took 7,216.520 ms, 2.217 MiB/s, 35.474 changes/s. Seed creation/pairing excluded; receiving SQLite/digest/fixture validation, polling, pacing and TLS included. No CRDT application cost measured.

Files: crates/zenith-sync/tests/transport.rs; crates/zenith-sync/src/transport/mod.rs (2ms poll, equal-jitter documentation); docs/SYNC.md; work-orders/sync/S05-transport-and-protocol.md; work-orders/sync/S05-report.md. Commit notes fall back here because both Git and .codex writes were denied.

## Green step 3

Intended commit: test: harden transport against lost acknowledgements and hostile peers

cargo test -p zenith-sync --offline passed 36 tests: 12 units, 4 merge, 8 pairing, 8 store/identity, 4 transport integrations. New tests exercise copied certificates signed with the wrong private key, missing client certificates, partial-frame interruption/deadline, durable receive with lost acknowledgement and retry, per-peer duplicate connection/rate flood, and active revocation. All passed. Clippy then found a test-only manual-range style warning; correction follows. Production shape validation remains absent. Sender scheduling now sleeps to the pacing deadline and polls idle store/pins at 100ms, avoiding a 2ms wakeup loop.

Files: crates/zenith-sync/src/transport/mod.rs; crates/zenith-sync/src/transport/codec.rs; crates/zenith-sync/src/transport/tests.rs; crates/zenith-sync/tests/transport.rs (follow-up lint correction pending); docs/SYNC.md; work-orders/sync/S05-transport-and-protocol.md; work-orders/sync/S05-report.md.

## Green step 4

Intended commit: fix: stop retrying TLS alerts and verify both-engine restart recovery

Final code checks: cargo test -p zenith-sync --offline passed all 36 tests (12 units + 24 integrations), zero failures/ignored; cargo clippy -p zenith-sync --all-targets --offline -- -D warnings passed; cargo fmt -p zenith-sync -- --check, cargo doc -p zenith-sync --no-deps --offline and git diff --check passed. Backlog now exceeds one store page: 1,200 x 4 KiB, both engine owners shut down and reopened during transfer, saved sender cursor retained, all unique changes converge and final sender cursor reopens at 1,200. InvalidData TLS alerts terminate reconnect; connection resets/timeouts remain retryable. Unit attack matrix additionally refuses zero-size frames, newer change versions and invalid phase transitions.

Files: crates/zenith-sync/src/lib.rs; crates/zenith-sync/src/transport/mod.rs; crates/zenith-sync/src/transport/tests.rs; crates/zenith-sync/tests/transport.rs; docs/SYNC.md; work-orders/sync/S05-transport-and-protocol.md; work-orders/sync/S05-report.md. Final documentation and sequential measurement results follow in the same reviewed tree.

## Green step 5: sequential measurements and final documentation

Intended commit: docs: record S05 transport evidence and remaining validation boundary

Three sequential invocations of cargo test -p zenith-sync --test transport --offline measure_empty_catchup_throughput -- --exact --nocapture --test-threads=1 passed (1 measured integration each, three filtered, zero failures/ignored). Samples: 6,705.857ms / 2.386 MiB/s / 38.176 changes/s; 7,189.181ms / 2.226 MiB/s / 35.609 changes/s; 7,104.002ms / 2.252 MiB/s / 36.036 changes/s. Median: 7,104.002ms and 2.252 MiB/s. Fresh 256 x 64 KiB (16 MiB) backlog, empty receiver; timer starts before TCP/TLS dial and ends at full receiver count plus durable sender cursor 256. Windows x64, Rust/Cargo 1.97.1 MSVC, unoptimized test profile with debug symbols/incremental disabled. No simultaneous Cargo/check processes during these measurements. Pairing/seeding and production CRDT validation/application excluded. SQLite, envelope/digest, synthetic validator, pacing, duplicate forwarding and completion polling included. Original payload bytes only; no transport compression. See S05 work order for reproducible command and complete table. These are single-machine observations, not release performance estimates.

Files: docs/SYNC.md; work-orders/sync/S05-transport-and-protocol.md; work-orders/sync/S05-report.md; work-orders/README.md (S04 merged status and S05 evidence row only).

## Final implementation and stopping boundary

Network transport implemented: pinned mutual TLS 1.3, exact live S04 certificates and signature possession, strict fixed-field frames/hello/version/summary/change/stream phases, durable matching acknowledgements, cursor resume, forwarding/deduplication, explicit backoff and cancellation, frame/global/per-peer/rate/deadline limits. The full final suite passed 36 tests: 12 units and 24 integrations (4 merge, 8 pairing, 8 store/identity, 4 transport). Clippy with warnings denied, formatting, offline docs and whitespace checks passed. The S03 merge property test still runs 96 cases per library. No network workaround, proxy, missing dependency or download was needed; only tokio-rustls was added from the existing cache.

The localhost acceptance tests ran three ports with real Automerge changes, three seeded edit/partition/heal rounds and forwarding/live streaming. A 1,200 x 4 KiB backlog was interrupted after at least 40 receipts; BOTH engine owners fully stopped before reopening their existing identities/stores, verified persisted cursor/data and completed all 1,200 content IDs, with the sender cursor durably reopened at 1,200. Security tests cover malformed/zero/oversized/unknown/newer messages, digest/sequence/phase violations, forged acknowledgements, host-validator refusal, unknown/revoked/missing/wrong-key certificates, wrong intended destination, rate flooding, connection limits and active revocation. Separate lost-ack and half-frame tests verify no premature cursor advance and idempotent replay. Slow partial frame times out after ten seconds. Reconnect survived a missing listener.

S05 remains In progress at a good, passing library boundary. The two original localhost convergence/measurement Done criteria are met, but production CRDT shape/resource validation was explicitly required in the inherited S03 design and remains unimplemented. A mandatory host validator gates storage and acknowledgement with no permissive default; the tests use rejecting and synthetic validators. The engine must move opaque blobs, so implementing schema/immutable logs/tombstones/dependency staging and decoded budgets requires the unfinished production application-model work. This is a release blocker, not a claim of complete protection from paired malicious data. S07 remains Not started.

## Unverified facts and largest risks

- No two real machines, hostile/blocked LAN, actual Windows firewall prompts, Windows directory ACL audit, CI, Tauri/app integration, abrupt process kill or power-loss test. Clean engine shutdown/reopen was verified; SQLite FULL durability against power loss is assumed from SQLite's contract.
- No independent audit of SPAKE2 composition, custom TLS pins or protocol. Exact pins deliberately replace certificate name/CA/expiry validation; both roles still delegate TLS 1.3 signatures to rustls. TLS client completion alone can precede the server rejecting client authentication; tests require the acceptor to fail before any data protocol access.
- No production CRDT semantic/decompression/memory/CPU validator. Byte caps and rates do not bound a blocking host decoder. SQLite/validator calls are synchronous and async timeouts cannot preempt them. An authorised malicious peer can send valid-looking harmful data, lie using a matching acknowledgement, or grow the append-only log. Revocation cannot erase already copied data.
- No total log/peer quota or compaction. Sender cursors assume receiver data never rolls back: stale backup restoration can miss already acknowledged rows; reset/re-pair on the sender is the current manual recovery. No dataset epochs or rollback detection.
- One pending change per direction limits performance as RTT grows. Benchmarks exclude CRDT application cost and use debug builds. No release/small-change/CPU/memory/energy/real-network throughput measurement. Budget maps retain previously paired IDs; budgets reset across process restart. Host must bound socket/task creation, choose one dialer per pair, update discovery addresses, and own one engine per directory. There is no automatic listener/discovery supervisor or Devices UI yet.
- Prior S03 representative private deployed-export/migration/lifecycle acceptance remains open. No keys, certificates, secrets, .env files or personal data were committed; test material is generated in temporary directories.

Owner must decide the production validator/resource and retention policies, stale-backup recovery and independent review before release, plus the existing one app/process, desktop/LAN-only scope/deferred relay, delete/restore/conflict UI and roaming preferences. A representative private deployed export is still needed for S03. No approval was requested for local reversible engineering.

## Assistant commit handoff

No S05 commit hash exists. Both the requested Git lock and .codex note path were refused by this sandbox, and no further Git writes were attempted. The five green-step messages/file lists above preserve the intended small commits. Some same-file snapshots were superseded by later steps, so they are historical boundaries rather than directly stageable patches. The assistant can review and commit the final tree with conventional messages and no attribution trailers; do not claim these notes are commits.

Final tree file list (all changed/new files):

- Cargo.lock
- crates/zenith-sync/Cargo.toml
- crates/zenith-sync/src/lib.rs
- crates/zenith-sync/src/transport/mod.rs
- crates/zenith-sync/src/transport/tls.rs
- crates/zenith-sync/src/transport/codec.rs
- crates/zenith-sync/src/transport/tests.rs
- crates/zenith-sync/tests/transport.rs
- docs/SYNC.md
- work-orders/sync/S05-transport-and-protocol.md
- work-orders/sync/S05-report.md
- work-orders/README.md (S04/S05 rows)

A single final-tree commit, if the earlier snapshots cannot be reconstructed, can use: feat: add pinned sync transport and localhost recovery tests. Keep code, design and work-order evidence together. No git push, gh, history rewrite or new branch action was run.

# S05 - Transport and the sync protocol

State: In progress (verified localhost transport boundary, 9 October 2026; production application/CRDT shape and resource validator remains open)

Owner: Mooketsi Vincent Magwaza, sole founder. Branch feat/sync-transport starts at merged S04 (5cfb33d); earlier S04 reports about an uncreated branch are historical and superseded by the owner's current checkout. No apps or tools were changed. S07 remains Not started.

## Goal and scope

Paired devices exchange opaque changes over pinned mutual TLS 1.3, catch up from durable sender-local cursors and stream new changes. Include strict length-prefixed framing, hello/version/capability refusal, summary/change/stream ordering, reconnect/backoff and resource limits. Validate incoming frame/envelope shape, size, version, sequence and digest, then require a host validator before storage or acknowledgement. No permissive validator is supplied.

## Implemented decisions

- tokio-rustls 0.26.6 / rustls 0.23.45 with ring, TLS 1.3 only, mandatory client certificate, exact live S04 DER pins, CertificateVerify signature checking, intended peer check, ALPN zenith-sync/1, no tickets/resumption. Unpaired/revoked peers are refused by the TLS acceptor. Copying the public pinned certificate without its private key fails the handshake. Active sessions check live pins and stop after revocation.
- Explicit fixed tag/field codec with raw opaque payload replaces a general-purpose binary collection decoder for S05. Maximum body is 262,187 bytes. Unknown tags, unexpected fields/phases, newer hello/change versions and capabilities are refused with local errors.
- The planned CRDT version-vector summary was incompatible with an opaque engine. Summary is this sender's durable head and outgoing acknowledged cursor. One pending change per direction; exact sequence/digest ack required. Receiver validates and commits before ack; sender durably stores cursor only after ack. Retried changes deduplicate. CaughtUp marks the initial head, then rows stream from the same log, including forwarding. The receiver's local sequence is never mistaken for the sender's sequence.
- Eight global connections including pre-authentication handshakes; one session per peer; ten-second whole-frame, handshake and acknowledgement deadlines; eight queued events; one fetched row per direction. Inbound shared token buckets: 512 frames/s, 2,048 burst; 8 MiB/s, 16 MiB burst. Connection admission consumes a token too. Buckets survive reconnect within the engine but reset on restart. Sender pacing: <=256 changes/s and <=4 MiB/s; 100ms idle polling and two-second pings. Host must bound accepting/task creation and choose one dialer per pair.
- Transient connection failures retry with equal-jitter exponential delay, initially 125-250ms and at most 15-30s. A session lasting ten seconds resets the exponent. Typed protocol/validation failures and InvalidData TLS alerts stop. Bare reset/EOF remains retryable because the remote reason is unavailable. Dropping futures stops transport; discovery/address refresh remains host-owned.

The full wire layout, limits, host obligations and limitations are in [docs/SYNC.md](../../docs/SYNC.md).

## Acceptance evidence

`cargo test -p zenith-sync --offline`: **36 passed**, zero failed/ignored: 12 units + 4 merge + 8 pairing + 8 store/identity + 4 transport integrations. The merge property test retains 96 cases against each library.

- Three engines listen on different localhost ports; real Automerge blobs cross A-B-C with forwarding. Three seeded valid edit/partition/heal rounds converge records, retain logs and hide deleted descendants; A-B streams while C is isolated.
- A 1,200-change x 4 KiB backlog exceeds a store page. Drop during transfer, stop/reopen both engine owners in the same private directories, retain source cursor and receiver data, heal and compare every content ID. Final outgoing cursor persists at 1,200.
- Drop half a frame: no change committed. Lose ack after durable receive: source cursor stays zero, retry deduplicates, then matching ack advances it. Whole-frame slow partial write times out.
- TLS refuses unknown/revoked/missing/wrong-key client certificates and a wrong intended destination. Authenticated malformed/zero/oversized/unknown/newer frames, corrupt digest, sequence/phase errors, forged ack and host validator failure never advance cursors or insert invalid changes.
- Eight pending handshakes refuse the ninth and cancellation releases slots. Duplicate peer session is refused, authenticated ping flood hits rate limit, live revocation closes a session. Reconnect succeeds after an absent listener returns. Budget refill and backoff bounds tested.

`cargo clippy -p zenith-sync --all-targets --offline -- -D warnings`, `cargo fmt -p zenith-sync -- --check`, `cargo doc -p zenith-sync --no-deps --offline`, `git diff --check`: passed. One test-only Clippy range-style finding was corrected. All Cargo commands used offline caches, no registry override or network workaround, dev/test debug symbols and incremental compilation disabled. No crate download was needed.

## Throughput and empty catch-up

Windows x64 / MSVC Rust and Cargo 1.97.1, unoptimized test profile. Three sequential fresh runs after other checks stopped:

```powershell
$env:CARGO_PROFILE_DEV_DEBUG='0'
$env:CARGO_PROFILE_TEST_DEBUG='0'
$env:CARGO_INCREMENTAL='0'
cargo test -p zenith-sync --test transport --offline measure_empty_catchup_throughput -- --exact --nocapture --test-threads=1
```

256 distinct opaque fixture changes x 64 KiB = 16 MiB original payload. Receiver starts empty. Timer spans dialing through receiver having all 256 and sender durably acknowledging cursor 256. Includes TLS, hashing, fixture validator, SQLite FULL writes, pacing, duplicate forwarding and completion polling. Excludes pairing/seeding, production CRDT validation/application and real-network latency. No transport compression. These are original payload bytes, not total TLS/bidirectional bytes.

| Sample | Catch-up ms | Payload MiB/s | Changes/s |
| --- | ---: | ---: | ---: |
| 1 | 6,705.857 | 2.386 | 38.176 |
| 2 | 7,189.181 | 2.226 | 35.609 |
| 3 | 7,104.002 | 2.252 | 36.036 |
| Median | **7,104.002** | **2.252** | **36.036** |

Earlier overlapping-suite sample was 7,216.520ms / 2.217 MiB/s and is not part of these medians. Three samples on one computer are not a performance promise. Release/small-change throughput, CPU/memory/energy and real RTT were not measured.

## Stopping boundary and remaining work

The localhost convergence and measurement Done criteria are met. S05 remains In progress because a production staged CRDT shape/resource validator was part of the inherited design and does not exist in S03. The engine moves opaque blobs; completing record schema, immutable-log/tombstone rules, dependency staging and decoded memory/CPU quotas is larger application-model work. Stop at this building, tested transport boundary. The required validator gate is implemented, with rejecting/synthetic test implementations; it does not prove production validation. Do not ship with a permissive implementation.

No two real machines or hostile network can be tested here; all network tests ran on localhost. S07 stays Not started. No Tauri integration, CI, ACL/firewall audit, independent protocol review, sudden process kill or power-loss test. SQLite FULL durability is assumed from its contract; clean engine reopen is verified. Host validators/SQLite are synchronous and async deadlines cannot preempt blocking work. Log/peer quotas, compaction and stale-backup/dataset rollback recovery are unimplemented; restoring old receiver data can miss previously acknowledged changes unless the sender cursor is reset by revoke/re-pair. Authorised malicious peers can lie about storage, send valid-looking harmful changes or exhaust the log; pins and byte caps do not defend against those behaviours. No claim that this design is secure.

Owner decisions: finish/approve the production validator and decoded resource/retention quotas; choose stale-backup recovery policy; obtain independent pairing/protocol review; confirm one app/process per directory, desktop/LAN-only scope and deferred relay, delete/restore/conflict behaviour and roaming preferences. Existing representative private deployed-export/migration acceptance remains open.

## Git and handoff

No local S05 commit exists: Git refused .git/index.lock (Permission denied), then .codex/commit-S05.txt also refused writes. Further Git writes stopped. Commit messages/file lists and the complete report are in [S05-report.md](S05-report.md), inside the allowed work-order directory. The owner's assistant must commit the reviewed tree; no push or gh was run.

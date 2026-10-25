# Sync engineering handoff — 9 October 2026

Owner: Mooketsi Vincent Magwaza (sole founder). All work stayed in the standalone clone `C:\Users\Nido\Desktop\Projects\Active\zenith-codex-sync`. S02/S03's code was already merged at baseline `2dbdc4e`. The merged S03 docs still record open deployed-export, production migration/lifecycle and adversarial model-validation checks; none was silently marked complete.

## Branches, commits and stopping boundary

| Task | Branch | Saved local commit | Current state |
| --- | --- | --- | --- |
| S04 | `feat/sync-pairing` | `4a9058c` — `feat: add bounded SPAKE2 pairing and private discovery` | Library implementation and loopback verification; follow-up tests/docs uncommitted; real-machine/network acceptance open |
| S05 | `feat/sync-transport` **not created** | None | Not started; required commit-then-branch order could not proceed |
| S07 | None created | None | Not started, as instructed |

The first S04 full suite passed 20 tests and was committed with its work-order/design evidence. A follow-up added successful real loopback multicast and concurrent-pairing-limit tests. Its intended commit (`test: verify loopback multicast and pairing concurrency`) **was not created**: Git refused `.git/index.lock` with `Permission denied` on add and commit. The subsequent attempted branch write also failed at `.git/refs/heads/feat/sync-transport.lock`. Read-only status/log confirmed the saved tip remains `4a9058c` on `feat/sync-pairing`, and no S05 branch exists. No further Git writes were attempted after this refusal.

Preserved working-tree changes: `tests/pairing.rs` adds the two tests; `src/lib.rs` clarifies pairing rustdoc; `docs/SYNC.md`, the S04/S05 work orders, the work-order README row and this report record the final design/evidence and blocker. Restore Git metadata write access, commit the preserved S04 follow-up, then create S05 from that commit. No push, `gh`, history rewrite or attribution trailer was used.

## What S04 implements

- Explicit 120-second pairing window, six-digit code generated from OS randomness, SPAKE2 0.4.0 and role-specific HMAC key confirmation. PAKE identities bind both certificate fingerprints and a fresh nonce; HKDF binds the entire exchange and derives separate confirmation/discovery keys. Success pins exact certificate bytes and a per-pair discovery secret transactionally. Certificates are public during explicit pairing; changes are unavailable on that endpoint.
- One concurrent exchange, 9 KiB frame cap, ten-second whole-frame and thirty-second exchange deadlines. SQLite schema v2 preserves the v1 log/pins/cursors and durably reserves each attempt before any response; five attempts lock new pairing for five minutes. Restart/new windows do not reset the budget. Successful pairing closes the acceptor window.
- Directional 128-bit truncated HMAC-SHA256 tokens cover sender identity, port and sixty-second epoch. Current/adjacent epochs accommodate limited clock skew. Tokens and DNS-SD host/instance names rotate; pins/secrets are removed on local revocation. No fleet-wide key lets a revoked member recognise all other members.
- Opt-in `_zenith-sync._tcp.local.` registration/browse, IPv4 TTL=1 UDP multicast fallback at 239.255.90.90:45891, bounded announcement codec and numeric IPv4/IPv6 manual entry without DNS/accounts/servers. Host owns listeners, addresses, discovery refresh and shutdown. No app or UI code changed; no automatic discovery scheduler or QR rendering exists yet.
- API change: replace the unavailable `finish_pairing(&[u8])` placeholder with asynchronous `pairing::accept` / `connect`; retain `start_pairing` and add `close_pairing`. Opening an engine still starts no network activity. Trusted-host pin/receive APIs are not network authentication.

## Commands and observed results

All Cargo commands used `--offline` and the shared pre-downloaded cache, with `CARGO_PROFILE_DEV_DEBUG=0`, `CARGO_PROFILE_TEST_DEBUG=0`, `CARGO_INCREMENTAL=0`. No proxy, registry override, network workaround or additional crate download was needed.

| Command | Observed result |
| --- | --- |
| `cargo test -p zenith-sync --offline` (first run) | 20 passed: 2 pairing units, 6 S04 integrations, 12 existing S02/S03 integrations; committed afterward |
| `cargo test -p zenith-sync --test pairing --offline` (follow-up) | 8 passed, including actual multicast delivery and simultaneous exchange refusal; subsequent commit failed |
| `cargo test -p zenith-sync --offline` (final run) | 22 passed: 2 units + 20 integrations; 0 failed/ignored; includes S03's 96 random cases against each library |
| `cargo clippy -p zenith-sync --all-targets --offline -- -D warnings` | Passed on final code/tests |
| `cargo fmt -p zenith-sync -- --check` | Passed |
| `cargo doc -p zenith-sync --no-deps --offline` | Passed |
| `git diff --check` | Passed; Git emitted only normal LF/CRLF conversion notices |

S04 tests paired two TCP instances on distinct localhost ports, restarted and recognised each other with persisted pins/secrets, checked epoch rotation and stale-token/port-tampering refusal, and revoked recognition. Wrong codes never created pins or copied changes. A TCP recording proxy captured a successful transcript; replay against a fresh pairing failed. Unit tests rejected confirmation reuse under different role, certificate, nonce or transcript, and advanced a deterministic store timestamp through lock expiry/restart. Tests also refused oversized frames, closed/expired windows, malformed announcements and a simultaneous second pairing. Two mDNS daemons restricted to IPv4 loopback registered/resolved DNS-SD; two sockets delivered a real multicast announcement on that interface. No skips were used.

**S05 measurements:** no throughput, empty-to-caught-up time or backlog number exists. No S05 code, TLS data endpoint, three-instance network convergence, streaming, reconnect/back-off or mid-transfer resume test was run. The existing three-replica property test tests merge semantics without networking and must not be presented as S05 evidence.

## What was not verified and largest risks

No two real machines, hostile/blocked-mDNS network, guest isolation, Windows firewall prompts, ACL audit, CI, Tauri integration, migration crash injection or production hostile CRDT validation was tested. S07 remains Not started. Runtime identities/certificates and synthetic fixtures were generated only in temporary test directories; no keys, certificates, secrets, `.env` or personal data were committed. No files under apps or tools changed.

1. **No TLS transport yet.** Pairing does not itself prove certificate private-key possession or protect a sync data endpoint. S05 must require mutual TLS 1.3, exact live pins and signature verification, including revoked/unknown peers. Current pin/receive methods remain trusted host boundaries.
2. **Unaudited pairing composition.** [RustCrypto's SPAKE2 README](https://github.com/RustCrypto/PAKEs/blob/master/spake2/README.md) states the crate has not had an independent third-party audit. The local transcript/KDF/confirmation composition has no audit either. Passing attack tests is limited evidence, not a security claim.
3. **Availability and clocks.** An attacker can deliberately consume five attempts. UTC clock jumps affect persisted lock duration; discovery clock skew beyond adjacent epochs prevents recognition. A lost final confirmation can leave asymmetric trust; revoke locally and retry. Process ownership remains a host requirement. Pairing codes/derived keys are not explicitly memory-zeroized.
4. **Discovery lifecycle/privacy.** Host must refresh on each epoch, window close and revocation and shut down when disabled. Tokens do not conceal IPs, ports, timing or paired-device counts. Replay within the tolerance window can cause connection attempts and requires TLS to enforce identity. Multicast is IPv4 only; manual entry accepts IPv6.
5. **Inherited storage/model limits.** Append-only log has no quota/compaction. S03 measured significant Automerge transient memory and has no production hostile-update shape/resource validator or private deployed-export acceptance. A payload byte limit alone cannot bound decompression/CRDT CPU or memory.

## Owner decisions and next work

Restore writable Git metadata first; no new permission flow was attempted from this sandbox. The required next engineering step is the preserved S04 commit followed by the S05 stacked branch. Confirm one app/process versus two, desktop/LAN-only first release and deferred relay, delete-wins with restore to a fresh ID, and which preferences roam. Supply a representative deployed export privately for the existing migration check. Before shipping, decide how to obtain independent pairing/protocol review, and run the real-machine/network acceptance under S07. There is no claim of production readiness or a secure design.

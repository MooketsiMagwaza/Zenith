# Cross-device sync

Status: 9 October 2026. S02, S03 measurement work and S04 are merged. S05 transport is implemented and verified on localhost on feat/sync-transport from merged S04 (5cfb33d); S05 remains In progress at this library boundary because production app/CRDT shape and resource validation is unimplemented. Inherited S03 migration/lifecycle acceptance remains open. Opening the engine starts no network activity. Owner: Mooketsi Vincent Magwaza, sole founder. Owner decisions remain open. This replaces the earlier hosted/account sync plan (X01).

## The idea

Your devices find each other on the same network and keep one set of decks, cards, sessions, journals and reminders in step. There is no account, no server and no internet needed. The data never leaves your devices. It works the way Syncthing and LocalSend do: devices introduce themselves directly, you approve each one once, and from then on they trust each other.

The sync engine is a small embedded service that lives inside the desktop apps. It is not an authentication service. Trust comes from pairing two devices, not from logging in.

## What the two projects teach

This is from memory of how they work; check each project's own documentation before copying anything.

- **Syncthing** gives each device a cryptographic identity, and a device ID is derived from its TLS certificate. Devices talk over mutual TLS, discover each other on the local network (and, optionally, through public discovery servers and relays), and exchange an index of what each has. It syncs files, so it has no notion of merging the contents of a record.
- **LocalSend** runs a small HTTPS server on every device with a self-signed certificate, finds peers by UDP multicast, and needs no account or internet. It sends files once; it does not keep two copies in step.

Zenith needs Syncthing's trust model and LocalSend's no-setup discovery, plus something neither has: merging two edits to the same record. That is what the data model below is for.

## Goals and non-goals

Goals:

- Two or more of your own devices on one network converge on the same data after edits on any of them, including edits made while they were apart.
- No account, no server, no telemetry. Pairing is explicit and can be undone.
- Traffic is encrypted and authenticated, and a stranger on the same Wi-Fi cannot read it, alter it or pair without your say-so.
- The apps work fully on their own when sync is off or no peer is around.

Non-goals for the first version: syncing across different networks (needs a relay, see S09), a hosted account, phones and browsers (see S08), and encryption of data at rest.

## Architecture

```
  apps/app (Tauri)          apps/popup (Tauri)
        \                         /
         +----  crates/zenith-sync  ----+
                  (Rust library)
   identity | discovery | pairing | transport | update store
```

- **`crates/zenith-sync`** is a Rust library used by the Tauri shells. It owns the device identity, discovery, pairing, the encrypted connections, and a local log of changes. It exposes a small interface: list peers, start and finish pairing, revoke a peer, push a local change, receive remote changes, report status.
- **The engine moves changes; the app merges them.** Changes are opaque, versioned blobs produced by a merge library in the app (see "Data model"). The engine stores them, tracks what each peer has seen, and sends what is missing. This keeps the network code independent of how decks and journals merge.
- **The web build is local only** in the first version. A browser cannot listen for connections or find peers. A later option (S08) is for the desktop app to serve a local web page that a phone's browser can open.

## Identity and pairing

- On first run each install creates a key pair and a self-signed certificate. The **device ID** is a fingerprint of the public key, shown in short groups like Syncthing's.
- **Pairing** joins two devices once:
  1. Device A opens "Add a device" and shows a QR code and a six-digit code. B opens the same screen and scans or types it.
  2. They run a password-authenticated key exchange over the connection (for example SPAKE2 or CPace), using that code, so that someone who sees the traffic, or starts a fake pairing, cannot learn the code or sit in the middle. As an alternative, both screens show a short string to compare (a "short authentication string" check).
  3. Each stores the other's certificate fingerprint. Later connections are mutual TLS and accept only pinned fingerprints.
- **Revoking** a device deletes its pin locally; it cannot reconnect to that device without pairing again. Each other device must revoke it separately. Revocation is not automatically distributed, and cannot erase data already copied to a lost device.
- **Limits:** pairing attempts are rate limited (for example five wrong codes, then a five-minute lock), a pairing window closes after a couple of minutes, and every frame has a size limit.

## Discovery

- Devices advertise a service such as `_zenith-sync._tcp` over mDNS and DNS-SD, and fall back to a UDP multicast announcement on networks that block mDNS.
- Announcements carry a rotating short token and a port, **not** a device name or a stable ID, so a stranger on the network learns only that "a Zenith device is here". Paired devices recognise each other from the token.
- Devices that are not paired are only discoverable while the pairing screen is open.
- Manual entry of an address and port is a fallback for locked-down networks.

## Transport and protocol

- TLS 1.3 with mutual authentication and pinned certificates (rustls with certificates from rcgen), over TCP.
- Length-prefixed frames in a compact binary format. First a hello with the protocol version and a capability list, then the exchange:
  1. each side sends its durable log head and its own outgoing acknowledged cursor;
  2. each side replays its log after that cursor; content IDs deduplicate changes already present, including forwarded changes;
  3. the connection stays open and streams new local changes until it drops, and the devices find each other again when it does.
- Unknown message types and newer protocol versions are refused with a clear error, so an old app never mangles data from a new one.

## Data model and merging

Zenith's data is a handful of kinds of record. They need different merge rules:

| Data | Rule |
| --- | --- |
| Decks, tasks (cards), checklist items, reminders, preferences | Automerge field registers: causal later writes replace observed values; concurrent writes have a deterministic displayed winner and retrievable conflicts. No wall-clock/HLC ordering. |
| Deleting a record | Monotonic tombstone: deletion wins visibility over concurrent and later ordinary edits. Never write `deleted=false` after creation. Restore explicitly under a new ID, retaining the deleted original and its conflicts. |
| Deleting a deck/task | Hide descendants and targeted reminders via the parent's tombstone; retain their underlying data. Session logs remain visible historical records. Concurrent additions under a deleted parent remain recoverable and hidden. |
| Session logs | Append-only ID-keyed records. Deduplicate session IDs; reject attempts to change an existing immutable log. Derive journal indicators and task totals rather than mutating logs or syncing accumulated totals as registers. |
| Journals | Native CRDT text; overlapping replacements retain both insertions and can need human cleanup. Metadata uses field registers. Rust and JS text offsets are explicitly UTF-16. |

**Do not write a merge library by hand.** S03 selects Automerge (Rust core with JavaScript bindings). Yjs/yrs was measured too and is substantially faster; the tradeoff and measurement limitations are in Decisions below. The adapters are test/benchmark code, not a production model or an incoming-data security boundary.

Documents are split into a catalog, monthly session-log shards and one document per journal. Compression preserves CRDT identities/history; source migration remains read-only until verified. The detailed contracts and unimplemented storage lifecycle are below.

## Threat model, in plain terms

The risk is another person or device on the same Wi-Fi, such as a café or a shared house.

This table describes required protections. S04 covers pairing/discovery on loopback; S05 adds pinned TLS and bounded protocol tests below. It is not evidence of security on a hostile LAN.

| Threat | Answer |
| --- | --- |
| Reading traffic | Everything is inside mutual TLS. |
| Pretending to be one of your devices | Only pinned certificates are accepted after pairing. |
| Taking over a pairing | A one-time code, a key exchange that does not reveal it, attempt limits, and a short window. |
| Learning who is on the network | Announcements carry a rotating token only. |
| A paired device sending bad data | Transport validates frame/envelope size, shape, version, sequence and digest. A mandatory host validator gates storage/acknowledgement. Production CRDT shape/resource validation remains open; revocation does not undo copied changes. |
| A stolen device | Revoke it from another device. Data at rest is not encrypted in v1, so this stays a known gap; the operating system's disk encryption is the defence until then. |

## Open questions for the owner

1. **One app or two?** The pop-up and the full app need the same store and the same engine. Running them as two windows of one Tauri app avoids two processes fighting over one file. Today they are separate apps (P01). Recommendation: one app with a main window and a pop-up window.
2. **First version scope.** The design assumes desktop devices (Windows, macOS, Linux) on one network, and no phones or browsers. Is that right?
3. **A hosted relay later?** It would let devices on different networks sync, and would bring back a small server. It is out of the first version.
4. **The earlier platform work** (a hosted API, rate limiting, Grafana and an admin dashboard) has been re-scoped around this engine. If you still want a hosted stack as a portfolio showpiece, say so and X03 and X04 return in full.

## Work orders

See [`work-orders/sync`](../work-orders/sync): S01 to S09.

## Implemented contract and limits (S02)

`Engine::open(app_private_directory)` creates or loads a P-256 key and rcgen self-signed certificate in one versioned `identity.bin`, and opens `updates.sqlite`. The full device ID is SHA-256 of DER SubjectPublicKeyInfo. Corrupt, oversized, newer, or mismatched identity material fails closed rather than silently changing identity. A first-write crash requires explicit host recovery. The host must ensure one engine/process owns a directory. Unix creation uses mode 0600; Windows inherits the supplied directory ACL, which has not been audited. Keys and SQLite are not encrypted at rest.

The public Rust interface covers identity, listing/revoking peers, local changes, remote subscriptions, durable catch-up and status. S04 replaces the unavailable `finish_pairing` placeholder with asynchronous `pairing::accept` and `pairing::connect`; `start_pairing` opens a window and `close_pairing` cancels it. `UpdateStore::pin` and `Engine::receive_remote_change` remain trusted-host APIs, not authentication endpoints: a supplied peer ID alone proves nothing. The transport enforces pinned TLS and the mandatory host Validator before calling receive; direct host APIs still bypass that network boundary.

Change envelope v1 has a version, SHA-256 content ID and 1–262,144 opaque payload bytes. The digest covers a domain separator, version and payload. The application must put document ID and operation identity inside the payload. Envelope validation checks version, length and digest; it cannot validate app/CRDT semantics. De-duplication is global by content ID. SQLite uses WAL and FULL synchronous writes; sequence numbers order local ingestion only. A peer cursor refers to this sender's log, advances monotonically only within its durable head, and must advance only after a remote durable acknowledgement. Received changes are kept for forwarding to other peers. No compaction or log quota exists yet.

Remote broadcast notifications are bounded hints (128 entries). A lagging subscriber must recover through `changes_after`; SQLite is the source of truth. Revocation removes the peer and cursor but keeps changes. Future database schemas are refused. The crate docs (`cargo doc -p zenith-sync --no-deps`) describe this boundary.

### Outstanding engineering risks

- S04 pairing and S05 pinned TLS have passing adversarial loopback tests. The host must not expose pin/receive methods to untrusted input. TLS signatures verify private-key possession; custom pin verifiers and pairing composition remain unaudited.
- Discovery uses a separate per-pair HKDF secret, directional truncated HMAC-SHA256 tokens and rotating mDNS host/instance names. Rotation does not hide IP addresses, ports, timing, number of peers or associations between simultaneous advertisements. Discovery is a hint, not authentication or network anonymity.
- Per-peer cursors are sender-local durable acknowledgements, not CRDT version vectors. S05 tests dropped partial frames, lost acknowledgements and both-engine restarts during transfer. Stale receiver backup restoration can still lose previously acknowledged data without an explicit sender cursor reset.
- The append-only log has no retention bound or compaction mechanism yet. S03 must measure growth and preserve causality/tombstones when deciding compaction. Application validation, memory limits and quotas still need design work for hostile paired peers.
- S03 verified synthetic merge convergence and JS/Rust interoperability and measured library costs. Real exported-data migration and real-device/network behaviour remain unverified; localhost transport measurements are recorded below. There is no production CRDT shape/resource validator yet.

S02 is merged (f77ff76), and S03's measurement work is merged (2dbdc4e). Work continues in the standalone `zenith-codex-sync` clone on `feat/sync-transport` from merged S04. Git and .codex writes were refused in this S05 sandbox; commit notes are preserved in work-orders/sync/S05-report.md. All checks use offline caches, without registry overrides or network workarounds. S03's actual deployed export and migration/document lifecycle checks remain open. S04 and S05 transport are implemented on loopback; production model validation is open and S07 is not started. Nothing here claims that the engine is secure or ready to sync user data.

## Decisions (S03, 8 October 2026)

### Library and conflict policy

Choose **Automerge 0.12.0 in Rust and @automerge/automerge 3.5.0 in JavaScript** for the first integration. The competing spike uses **yrs 0.28.0 / yjs 13.6.33**. Both native-text models converged in the tests, including overlapping journal replacements. Automerge's `get_all`/`getConflicts` exposes simultaneous field values for a recovery interface; this was directly tested in Rust. One core on both sides and its retained history reduce the amount of custom conflict recovery we would need. These are engineering reasons for the choice, not speed claims. Yjs/yrs wins load/merge speed and JS memory in this workload and remains a fallback if representative user data makes Automerge too costly. See the primary [Automerge conflict contract](https://automerge.org/docs/reference/documents/conflicts/) and [Yjs update contract](https://docs.yjs.dev/api/document-updates).

Remove the proposed HLC rule. Causal ordering and deterministic concurrent winners come from the library, independent of wall-clock skew. `createdAt`/`updatedAt`/`fireAt` remain app metadata and reminder inputs; clocks can still affect scheduling, but cannot win a sync register by jumping into the future. A new causal field write resolves its observed conflicting values. A future host must surface retained conflicts rather than silently presenting the winner as the only edit.

Delete wins visibility. Deleted records and edited descendants stay in history/recovery; ordinary edits do not resurrect them, even after observing the deletion. Only a deliberate restore creates a fresh ID. The randomized tests verify this policy under valid operations. A malicious peer can encode a false tombstone or mutate a log: the spike adapters accept trusted traces, and **do not enforce** this boundary. S05 requires a staged, bounded host document validator before durable acknowledgement or application, including record kinds, immutable IDs/logs, monotonic tombstones, text/operation counts, dependency limits and schema version. Only the transport gate is implemented: S03 has no production model validator, and completing it exceeds this transport boundary. The 256 KiB envelope cap alone does not bound decompressed CRDT memory or CPU.

### Measured costs and assumptions

Runs used Windows x64, Rust 1.97.1 MSVC, Node 24.18.0, and the root release profile (`opt-level=s`, LTO) for native benchmarks. The spike's Automerge dependency declares Rust 1.90 minimum, so the crate manifest now reflects that; only Rust 1.97.1 was tested. Raw seven-sample reports and commands are in [`tools/sync-bench`](../tools/sync-bench/README.md). Times below are medians in milliseconds; sizes are exact measured bytes. Random actor/client IDs can change saved sizes slightly on rerun. Preliminary timings overlapped compilation; the committed JS measurements were refreshed sequentially after compilation stopped. Numbers are single-machine observations, not universal performance promises.

**Unsplit document, imported final year + 365 edit batches:**

| Runtime/library | Saved bytes | Build ms (one sample) | Load ms | Merge ms | Memory |
| --- | ---: | ---: | ---: | ---: | --- |
| JS Automerge | 77,958 | 2,085.18 | 409.54 | 72.73 | RSS delta 175.38 MiB; V8 heap delta 15.32 MiB |
| JS Yjs | 1,271,532 | 53.57 | 30.51 | 1.54 | RSS delta 38.53 MiB; V8 heap delta 12.87 MiB |
| Rust Automerge | 72,249 | 954.56 | 213.28 | 44.77 | live requested allocation delta 1.89 MiB; build/save peak delta 151.04 MiB |
| Rust yrs | 1,391,720 | 34.09 | 34.56 | 0.78 | live requested allocation delta 13.98 MiB; build/save peak delta 14.98 MiB |

Merge workload: each side makes 100 field changes and 100 journal insertions while apart, then applies the other side's missing changes. Fork/load/edit time is excluded. Yjs/yrs includes state-vector diff encoding; Automerge uses native merge. Native formats differ in compression and operation layout; compare within each runtime. JS memory includes WASM/runtime/allocator retention, measured after GC with parsed JSON excluded from baseline. V8 heap omits Automerge WASM memory. Rust's counting allocator excludes allocator overhead, OS memory and source JSON. These memory measures are not interchangeable. Live allocation is after saving, peak is build+save; this does not measure peak load/merge memory or the engine's SQLite footprint.

**379-document layout, JS only:**

| Library | Total saved bytes | Load all ms | One journal merge ms | RSS / V8 heap delta MiB |
| --- | ---: | ---: | ---: | --- |
| Automerge | 249,691 | 217.04 | 0.7505 | 86.88 / 14.27 |
| Yjs | 1,249,592 | 47.58 | 0.0209 | 45.54 / 14.49 |

The one-journal workload inserts once per side, unlike the unsplit 100-journal workload. Splitting allows lazy journal loads; actual Tauri startup/render performance was not measured. The catalog could still grow large and needs production quotas.

**Assumed usage**, not user telemetry: 12 decks, 144 tasks, 432 checklist items, 24 reminders, preferences, six sessions/day for 365 days (2,190 logs), one roughly 150-word journal/day (365 journals), and one edit batch/day. Generated JSON with document assignments is 1,158,551 bytes. Prose repeats heavily, which favours Automerge compression. This is a final-state import plus replay of representative edits, **not** a simulation of every keystroke or all incremental history from a real year. Multi-year growth, incompressible/large journals, different workloads and low-memory devices remain unmeasured.

**Implementation effort:** source line counts in the spike (including blanks) are 22 Automerge / 30 Yjs JS adapter lines, and 113 Automerge / 120 yrs Rust adapter+materializer lines. Counts are a limited measured proxy, not hours or production complexity. Both needed native text, transactions, save/load and merge. Rust needed explicit scalar materialization and UTF-16 configuration; JS needed `ImmutableString` for scalar fields versus journal text. Both passed the compatibility probe. App command translation, editor bindings, conflict UI, manifest/checkpoint code and hostile-input validation are unimplemented; estimates of that work are assumptions. Automerge's roughly 151 MiB build/save peak and JS RSS are the largest measured library risk, despite the storage advantage. Revisit the choice against a representative private export before shipping.

### Document boundaries and history (contract)

- One catalog document contains decks, tasks, separate ID-keyed checklist items (`taskId`, `order`), reminders and shared preferences. Records are map entries, not array positions; imports preserve original display order in the private source archive. Journal and log references point to stable IDs.
- One document per journal keeps native text independent of log history. One document per UTC session-start month holds immutable session logs. The generator produces 379 documents for this year (catalog + 13 months + 365 journals). These boundaries were benchmarked in JS; native sharded memory/load costs have not been measured.
- Each dataset has a random namespace and a manifest of document IDs/schema/Automerge heads. Document IDs include that namespace. Bootstrap new peers from existing saved bytes. Never independently create a new `records` object for an already existing document: concurrent creation of nested maps yields conflicting containers, not automatic combination of their children. Independent imports use separate namespaces until reconciled deliberately. Genesis/manifest crash recovery is not yet implemented.
- Each host generates fresh actor IDs; an actor is not a device certificate ID. A document's saved bytes preserve operation IDs, tombstones and conflicts. `save` compresses history; it does **not** reset causality or erase old edits. Save/load followed by late merges is tested. Do not rebuild a live document from materialized JSON or garbage-collect tombstones on a timer. Yjs update merging alone also does not garbage-collect content ([primary documentation](https://docs.yjs.dev/api/document-updates)); its default GC is a different history/recovery tradeoff ([Y.Doc](https://docs.yjs.dev/api/y.doc)).
- Planned storage compaction: checkpoint per document after 1,000 accepted changes or on clean shutdown (threshold assumed, not measured), write+fsync a new versioned snapshot, read it back, then atomically publish its manifest. Keep the previous snapshot for recovery. A future protocol must support snapshot bootstrap and generation acknowledgements before deleting sender log rows/cursors. S02's SQLite log still has **no pruning, quota or checkpoint implementation**. Until that exists, keep all updates; there is no safe bounded-history claim. Resetting history into a new epoch would require every retained peer's acknowledgement and a forced rebootstrap of excluded old peers.

### Migration without silent loss

The read-only candidate builder is `tools/sync-bench/migrate.mjs`. It supports browser `zenith.popup.state`, the Tauri `zenith-popup.json` file's `state` member, and an export object of full-app `toggl_zen_decks`, `toggl_zen_logs`, `toggl_zen_journals`, `toggl_zen_reminders`, `toggl_zen_active` values. Full-app preferences also live in `zenith.tutorial.seen` and `zenith.zen.*` keys; custom quote/wall arrays are preserved as exact JSON scalar fields. Local wallpaper indexes and active timers remain device-local. Permission grants remain device-local too. Unknown keys and fields are retained in the exact private archive, not silently discarded.

Flatten nested full-app tasks and checklists into ID-keyed records, map journal `body` to native `content`, and preserve journal links, cached labels, timestamps, counts, orphan records and all logs. Never apply the full app's existing journal cleanup/deduplication to the migration source. Duplicate IDs, malformed JSON/collections, reserved schema fields or missing journal text fail the candidate build; keep the original and report the conflict. Matching target IDs do not authorize dropping separate journal IDs. An actual older/deployed export is still needed to validate assumptions about optional and unknown fields.

Task totals require special handling: set `legacySecondsOffset = imported totalSeconds - sum(imported unique log durations for that task)`, retaining signed discrepancies. Thereafter derive the display total as this offset plus the sum of unique session logs; never increment a synced `totalSeconds` register. A test with a reported total of 99 seconds and 30 seconds of imported logs reproduces 99 rather than 129. Retain the old `totalSeconds` as source metadata only. Cross-source duplicate logs/offsets require reconciliation, not addition of two imports' offsets. Session IDs must be globally unique; independently running timers can legitimately produce different sessions.

The production installation protocol is a **contract, not implemented app integration**: quiesce writes and snapshot all keys/file bytes before hydration can mutate them; store an exact private backup and source SHA-256; build the candidate in a fresh namespace; compare every source ID, field/text and log count, and verify save/load; write/fsync snapshots and manifest; atomically switch only after verification and a durable migration receipt keyed by source hash. Restart resumes the candidate/receipt without duplicating sessions. Do not delete the original or replace an established sync dataset on retry. Stop/resume active timers locally without inventing logs. The builder neither reads live storage nor performs that switch. Real source archives must stay in the private app directory and never enter this public repository.

### Verification and boundary

`cargo test -p zenith-sync --offline`: 12 tests passed, including 8 S02 and 4 S03. The property test runs 96 cases on both libraries: three replicas editing decks, tasks, checklist items, journals, reminders, preferences and new session-log IDs while partitioned; shuffled delivery, duplicates and save/load restarts; tombstone visibility and retained text/log content. Separate tests cover conflicting field recovery, overlapping text replacement and UTF-16 offsets after emoji. `node --test --test-isolation=none tools/sync-bench/model.test.mjs`: 7 tests passed, including all six merge permutations and three synthetic migration shapes. The explicit JS -> Rust edit -> JS probe passed both formats, exact field equality, Unicode, and insertion at offset 7 after an emoji.

This became a larger spike than a library swap: persistence shapes, totals, retained conflicts, document bootstrap and Unicode offsets all affect correctness. The S03 handoff stopped at this committed, passing measurement boundary. S03's actual deployed-export check and production lifecycle validation remain open. At that handoff S04/S05 had not begun; the owner subsequently merged the measurement work and authorised S04/S05 on 9 October. S07 stays Not started. S03 did not run CI, real devices, hostile network, Tauri integration, migration crash injection, multi-process ownership, adversarial CRDT/resource tests or network throughput. Owner decisions: confirm delete-wins with explicit restore, shared versus device-local preferences, and one app/process versus two; provide a representative private deployed export for the acceptance check. Existing S01 scope/relay questions remain open.

## Implemented pairing and discovery (S04, 9 October 2026)

The host explicitly opens a 120-second pairing window, supplies listeners/addresses and copies a random six-digit code out of band. `pairing::accept` and `connect` use RustCrypto SPAKE2 0.4.0, fresh state for each exchange, certificates and a random server nonce as role-specific identities. HKDF-SHA256 binds both certificates, both PAKE messages and the nonce, deriving independent HMAC confirmation keys and a discovery secret. Pins and secrets are written only after the opposite role's constant-time key confirmation. No document/change data is available from this separate pairing endpoint. Certificates are public and visible while pairing; this is an intentional exception to the encrypted data protocol. A copied code authorises pairing, so the host must never publish or log it. QR rendering belongs to S06.

SQLite schema v2 migrates the v1 store transactionally, retaining updates/cursors and adding per-pair secrets and an attempt gate. Five reserved exchanges (including malformed/abandoned ones) lock new pairing for five minutes. New windows/restart cannot reset attempts. Reservations are atomic and durable before any response; success resets the budget and closes the window. One concurrent exchange, 9 KiB frame limit, 10-second frame deadline and 30-second exchange deadline bound this endpoint. The window uses monotonic time; persistent locks use UTC seconds. Local clock jumps/rollback can shorten/extend a lock. A LAN attacker can spend the budget to cause denial of pairing. A dropped final confirmation can leave asymmetric trust; revoke locally and retry. S05 TLS now checks certificate private-key possession with rustls signature verification.

Discovery uses one **per-pair** secret, not a fleet-wide key. HMAC-SHA256 covers a domain, sender key ID, 60-second epoch and port; the first 128 bits are advertised. Receivers accept only the current or adjacent epoch. Directional tokens avoid reflection; revocation deletes the local secret as well as the pin/cursor. A stranger cannot derive identity from a token; an authorised peer can recognise its partner. Replay within the clock-tolerance window can redirect connection attempts, but never grants data access. IPs, ports, timing and simultaneous advertisement counts remain observable. Other devices must revoke separately.

DNS-SD uses `_zenith-sync._tcp.local.` with token-derived rotating instance and host names and token/epoch TXT fields. IPv4 multicast fallback uses 239.255.90.90:45891 and TTL=1 with the same bounded codec; numeric IPv4/IPv6 manual entry needs no DNS/server. Unpaired installs produce no announcements outside a live pairing window. **Host obligation:** refresh the mDNS registrations and multicast advertisements each epoch and on window close/revocation, and shut the daemon down when sync is disabled. No Tauri integration or automated discovery scheduler exists yet.

Verified: 22 tests total, including 8 S04 integrations, loopback TCP pairing/restart, DNS-SD resolution, actual multicast delivery on the loopback interface, wrong code, raw captured-transcript replay, confirmation substitution, lock persistence/expiry, closed/expired windows, concurrency and frame/announcement limits. [RustCrypto's README](https://github.com/RustCrypto/PAKEs/blob/master/spake2/README.md) states that the crate has not received an independent third-party audit. This composition is also unaudited. Real machines, hostile/blocked networks, firewall behaviour and ACLs are unverified; S07 stays Not started. See the S04 work order for exact commands and remaining acceptance.

## Implemented transport contract (S05, 9 October 2026)

The transport uses tokio-rustls 0.26.6 / rustls 0.23, ring, TLS 1.3 only and ALPN `zenith-sync/1`. Both verifier roles consult the live S04 store for exact certificate DER and key identity, require a single certificate, and delegate CertificateVerify signatures to rustls's provider. The dialer additionally checks the intended device. No public CA, DNS name or certificate expiry is an authority here: exact pairing pins are the trust roots. Session resumption/tickets are explicitly disabled; early data remains disabled by rustls defaults, so a reconnect cannot bypass live revocation. See the [rustls verifier contract](https://docs.rs/rustls/0.23.45/rustls/client/danger/trait.ServerCertVerifier.html). These custom verifier decisions are unaudited.

Protocol v1 uses a four-byte big-endian length, then a fixed tag and fixed big-endian fields, with raw payload bytes for changes. There are no nested attacker-sized collections. Hello (tag 0) is version:u16, capabilities:u32 (must be zero), device ID:32 bytes. Summary (1) is log head:u64 and outgoing acknowledged cursor:u64. Change (2) is sender sequence:u64, envelope version:u16, digest:32 bytes, payload. Ack (3) is sequence:u64 and digest:32 bytes. CaughtUp (4) is initial head:u64; Ping (5) has no fields. Unknown tags, nonexact fixed shapes, unsupported versions/capabilities and out-of-phase messages close the session with a typed local error; no speculative forward compatibility. Protocol errors are not returned as attacker-controlled text on the wire.

The earlier version-vector summary assumption was wrong for an opaque engine. S02 cursors are local to each sender, so summaries convey progress rather than CRDT state. One outstanding change per direction must receive an exact sequence/digest acknowledgement before the sender durably advances its cursor. The receiver checks contiguous sender sequences from the advertised cursor, validates the envelope and required host Validator, commits to SQLite with FULL synchronous writes, then queues an acknowledgement. Loss before either acknowledgement write/receipt can resend the same change; deduplication makes that safe. CaughtUp marks completion through the connection's initial head; subsequent rows stream, including received rows forwarded to other peers. A lagging stream polls the durable log, never relies on lossy notifications. No log compaction, restored-old-database detection or lost-ack reset protocol exists: restoring a receiver's stale backup requires revoke/re-pair on the sender to reset its cursor.

Limits: 262,187-byte frame body (256 KiB payload + 43 bytes), eight total in-flight connections including handshakes, one session per authenticated peer, ten-second TLS/frame/ack deadlines, eight internal events, one fetched log row per direction. Two-second pings keep idle streams alive. Per-peer inbound token buckets share reconnect state within one engine process: 512 frames/s with 2,048 burst, 8 MiB/s with 16 MiB burst. Restart resets this availability budget; pairing limits remain durable. Sender pacing targets at most 256 changes/s and 4 MiB/s (actual polling/RTT/disk can be slower). Slow whole frames time out. The host owns accepting sockets and task bounds before calling accept; no protection from kernel backlog exhaustion or arbitrary host task spawning is claimed.

Reconnection retries transient I/O, timeout and busy errors with exponential jitter from 125-250 ms initially to 15-30 s maximum; healthy sessions of ten seconds reset the exponent. InvalidData TLS alerts and typed protocol/validation failures require host action. A bare reset/EOF cannot reveal whether the other host deliberately refused us and remains retryable. Drop futures to stop sync. The host must assign one dialer per pair, refresh addresses using discovery and keep one engine per directory. Live pins are rechecked during protocol processing and on each poll; revocation prevents new receipt and closes idle active sessions. Already committed data cannot be withdrawn.

Idle store/pin polling is 100ms; a pacing-deadline sleep handles backlog sending. Each connection admission also consumes the same per-peer frame budget. The per-peer budget map is retained for the engine lifetime, including revoked IDs; total paired-device/log quotas are not implemented.

The required Validator has no permissive default. It must reject unsupported app schema, invalid immutable records/tombstones and decoded resource overuse, tolerate duplicates/out-of-order dependencies, and avoid modifying live documents before the log commit. Only synthetic validators exist in these tests. Writing a production validator is S03 application-model work and a release blocker; making the transport parse Automerge would contradict the opaque-engine boundary. Payload/frame caps do not bound decompression, application CPU/memory, total log growth, or damage by an authorised malicious peer.

### S05 verification and measured costs

Final code: `cargo test -p zenith-sync --offline` passed **36 tests** (12 units + 24 integrations), zero failed/ignored. The existing merge property test still runs 96 cases against both libraries. `cargo clippy -p zenith-sync --all-targets --offline -- -D warnings`, format check, offline API docs and diff whitespace check passed. All Cargo runs used cached crates offline, with dev/test debug symbols and incremental compilation disabled. No extra download or network workaround was needed.

Ran on localhost: three different TCP ports with real Automerge change blobs, seeded random valid edits across three partition/heal rounds, live streaming and forwarding; a 1,200 x 4 KiB backlog spanning more than one store page; both engines stopped/reopened during transfer with identities, received blobs and outgoing cursors preserved; partial-frame drop; durable receipt followed by a lost acknowledgement and deduplicated retry; absent listener followed by successful reconnect; malformed/zero/oversized/unknown frames and newer hello/change versions; corrupt digest, sequence/phase violations, forged ack, mandatory validator rejection; unknown/revoked/missing/wrong-key certificates and wrong intended destination; duplicate peer sessions, global handshake admission, rate flooding and active revocation; whole-frame slow-write timeout. Three-replica record equality, deleted descendants hidden and historical logs visible were verified for valid test operations. This is not hostile CRDT validation.

Sequential benchmark command (run three times after other checks stopped):

```powershell
$env:CARGO_PROFILE_DEV_DEBUG='0'
$env:CARGO_PROFILE_TEST_DEBUG='0'
$env:CARGO_INCREMENTAL='0'
cargo test -p zenith-sync --test transport --offline measure_empty_catchup_throughput -- --exact --nocapture --test-threads=1
```

Windows x64, Rust/Cargo 1.97.1 MSVC, unoptimized test profile; Node 24.18.0 installed but unused for S05. Each run creates fresh temp identities/stores, pairs on localhost, seeds 256 distinct 64 KiB opaque fixture changes (16,777,216 bytes), and starts an empty receiver. Timing starts immediately before dialing and ends when the receiver has all 256 unique changes AND the sender's outgoing cursor is durably 256. Includes TCP/TLS, envelope checks, synthetic validator, SQLite FULL writes at both ends, pacing, duplicate forwarding and completion polling. Excludes identity/pairing/seeding, production CRDT validation/application, disk power-loss guarantees and real-network latency. Synthetic bytes repeat; transport applies no compression. Payload throughput counts original payload bytes, not total bidirectional/TLS bytes.

| Sample | Empty catch-up ms | Payload MiB/s | Changes/s |
| --- | ---: | ---: | ---: |
| 1 | 6,705.857 | 2.386 | 38.176 |
| 2 | 7,189.181 | 2.226 | 35.609 |
| 3 | 7,104.002 | 2.252 | 36.036 |
| Median | **7,104.002** | **2.252** | **36.036** |

One machine and three samples; these are observations, not performance promises. One outstanding change limits throughput on high RTT links. Durable SQLite commits, hashing and pacing cost more than a bulk file transfer. Release-build throughput, small-change throughput, memory/CPU/energy profiling and WAN behaviour were not measured.

Assumptions/open work: SQLite FULL's durability is relied on, not proven with power loss; restart tests cleanly close engine owners and reopen stores, not abrupt process kill. The mandatory host validator must bound decoding/semantics; it is not implemented for production. Synchronous SQLite/validation can block Tokio workers, and async deadlines do not preempt a blocking validator. No total log/peer quota, compaction, stale-backup rollback detection, dataset epochs, reliable application-delivery receipt, automatic dial/discovery scheduler or Tauri integration exists. A paired malicious device can lie with a matching acknowledgement or valid-looking malicious data; cryptography cannot prove its disk writes or intent. TLS and pairing composition are unaudited. No real machines, hostile LAN, firewall/ACL audit, CI or power-loss testing was performed; **S07 stays Not started**. Owner must choose production validator/resource and retention policy, stale-backup recovery, independent review, one process/app ownership and the existing desktop/relay/preference/conflict policies before release.

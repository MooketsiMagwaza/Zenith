# Cross-device sync

Status: 9 October 2026. S02 and the S03 measurement work are merged; S03 migration/lifecycle limits below remain open. S04 implements opt-in discovery and SPAKE2 pairing, tested on loopback. S05 transport follows on a stacked branch. Opening the engine starts no network activity. Owner: Mooketsi Vincent Magwaza, sole founder. Owner decisions remain open. This replaces the hosted sync API with accounts that an earlier plan (X01) described.

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
  1. each side sends a summary of what it has (per merge library, a version vector or state vector);
  2. each side sends the changes the other is missing;
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

This table describes required protections. The S04 evidence below covers pairing and discovery on loopback; TLS and the data endpoint still require S05. It is not evidence of security on a hostile LAN.

| Threat | Answer |
| --- | --- |
| Reading traffic | Everything is inside mutual TLS. |
| Pretending to be one of your devices | Only pinned certificates are accepted after pairing. |
| Taking over a pairing | A one-time code, a key exchange that does not reveal it, attempt limits, and a short window. |
| Learning who is on the network | Announcements carry a rotating token only. |
| A paired device sending bad data | Updates are validated against size and shape limits before they are applied, and a peer can be revoked. |
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

The public Rust interface covers identity, listing/revoking peers, local changes, remote subscriptions, durable catch-up and status. S04 replaces the unavailable `finish_pairing` placeholder with asynchronous `pairing::accept` and `pairing::connect`; `start_pairing` opens a window and `close_pairing` cancels it. `UpdateStore::pin` and `Engine::receive_remote_change` remain trusted-host APIs, not authentication endpoints: a supplied peer ID alone proves nothing. S05 must enforce TLS before calling receive.

Change envelope v1 has a version, SHA-256 content ID and 1–262,144 opaque payload bytes. The digest covers a domain separator, version and payload. The application must put document ID and operation identity inside the payload. Envelope validation checks version, length and digest; it cannot validate app/CRDT semantics. De-duplication is global by content ID. SQLite uses WAL and FULL synchronous writes; sequence numbers order local ingestion only. A peer cursor refers to this sender's log, advances monotonically only within its durable head, and must advance only after a remote durable acknowledgement. Received changes are kept for forwarding to other peers. No compaction or log quota exists yet.

Remote broadcast notifications are bounded hints (128 entries). A lagging subscriber must recover through `changes_after`; SQLite is the source of truth. Revocation removes the peer and cursor but keeps changes. Future database schemas are refused. The crate docs (`cargo doc -p zenith-sync --no-deps`) describe this boundary.

### Outstanding engineering risks

- S04 pairing has passing adversarial loopback tests; TLS remains for S05. The host must not expose pin/receive methods to untrusted input. Certificate possession must be verified in TLS as well as matching the stored pin.
- Discovery uses a separate per-pair HKDF secret, directional truncated HMAC-SHA256 tokens and rotating mDNS host/instance names. Rotation does not hide IP addresses, ports, timing, number of peers or associations between simultaneous advertisements. Discovery is a hint, not authentication or network anonymity.
- Per-peer cursors are sender-local durable acknowledgements, not CRDT version vectors. S05 must specify resume and acknowledgement ordering and test mid-transfer failures before advancing them.
- The append-only log has no retention bound or compaction mechanism yet. S03 must measure growth and preserve causality/tombstones when deciding compaction. Application validation, memory limits and quotas still need design work for hostile paired peers.
- S03 verified synthetic merge convergence and JS/Rust interoperability and measured library costs. Real exported-data migration, transport throughput and real-device/network behaviour remain unverified. There is no production CRDT shape/resource validator yet.

S02 is merged (f77ff76), and S03's measurement work is merged (2dbdc4e). Work continues in the standalone `zenith-codex-sync` clone on `feat/sync-pairing`; the earlier linked-worktree Git blocker is resolved. All checks use offline caches, without registry overrides or network workarounds. S03's actual deployed export and migration/document lifecycle checks remain open. S04 is implemented on loopback, S05 follows, and S07 is not started. Nothing here claims that the engine is secure or ready to sync user data.

## Decisions (S03, 8 October 2026)

### Library and conflict policy

Choose **Automerge 0.12.0 in Rust and @automerge/automerge 3.5.0 in JavaScript** for the first integration. The competing spike uses **yrs 0.28.0 / yjs 13.6.33**. Both native-text models converged in the tests, including overlapping journal replacements. Automerge's `get_all`/`getConflicts` exposes simultaneous field values for a recovery interface; this was directly tested in Rust. One core on both sides and its retained history reduce the amount of custom conflict recovery we would need. These are engineering reasons for the choice, not speed claims. Yjs/yrs wins load/merge speed and JS memory in this workload and remains a fallback if representative user data makes Automerge too costly. See the primary [Automerge conflict contract](https://automerge.org/docs/reference/documents/conflicts/) and [Yjs update contract](https://docs.yjs.dev/api/document-updates).

Remove the proposed HLC rule. Causal ordering and deterministic concurrent winners come from the library, independent of wall-clock skew. `createdAt`/`updatedAt`/`fireAt` remain app metadata and reminder inputs; clocks can still affect scheduling, but cannot win a sync register by jumping into the future. A new causal field write resolves its observed conflicting values. A future host must surface retained conflicts rather than silently presenting the winner as the only edit.

Delete wins visibility. Deleted records and edited descendants stay in history/recovery; ordinary edits do not resurrect them, even after observing the deletion. Only a deliberate restore creates a fresh ID. The randomized tests verify this policy under valid operations. A malicious peer can encode a false tombstone or mutate a log: the spike adapters accept trusted traces, and **do not enforce** this boundary. S05 needs a staged, bounded document validator before durable acknowledgement or application, including record kinds, immutable IDs/logs, monotonic tombstones, text/operation counts, dependency limits and schema version. The 256 KiB envelope cap alone does not bound decompressed CRDT memory or CPU.

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

This became a larger spike than a library swap: persistence shapes, totals, retained conflicts, document bootstrap and Unicode offsets all affect correctness. Stop at this committed, passing measurement boundary. S03's actual deployed-export check and production lifecycle validation remain open; it is not marked Done. S04/S05 have not begun and no stacked branch is created prematurely. S07 stays Not started. No CI, real devices, hostile network, Tauri integration, migration crash injection, multi-process ownership, adversarial CRDT/resource tests or network throughput were run. Owner decisions: confirm delete-wins with explicit restore, shared versus device-local preferences, and one app/process versus two; provide a representative private deployed export for the acceptance check. Existing S01 scope/relay questions remain open.

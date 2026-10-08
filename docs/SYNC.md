# Cross-device sync

Status: implementation started, 8 October 2026. S02 supplies the embedded crate, identity and durable update log. Pairing and transport are not yet implemented; opening the engine starts no network activity. Owner decisions remain open. This replaces the hosted sync API with accounts that an earlier plan (X01) described.

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
| Decks, cards, checklist items, reminders, preferences | Proposed: field registers ordered by a hybrid logical clock. S03 must settle skew bounds and conflict policy: an HLC alone does not prevent a future-skewed timestamp from dominating other edits. |
| Deleting a deck or card | A tombstone. An edit made after the deletion on another device keeps the record; one made before does not. This is a rule to decide in S03 and write a test for. |
| Session logs | Append-only. Two devices never need to merge one log entry, and entries are identified so duplicates collapse. |
| Journals | Text that two devices may edit at once. A text merge (a CRDT) keeps both edits instead of dropping one. |

**Do not write a merge library by hand.** Use an existing one, either Automerge (a Rust core with JavaScript bindings; documents of maps, lists and text, with a built-in sync protocol) or Yjs with its Rust port yrs (fast, widely used, strong on text). S03 is a short spike that models the real Zenith data in both, measures size and speed on a realistic year of use, and picks one. The pick is not made here.

Open design points that S03 must settle: how large the change history grows and how it is compacted; how to split data into several documents so one journal does not carry a year of session logs; how to migrate today's `localStorage` and pop-up file into the first document without loss.

## Threat model, in plain terms

The risk is another person or device on the same Wi-Fi, such as a café or a shared house.

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

The public Rust interface covers identity, listing/revoking peers, local changes, remote subscriptions, durable catch-up and status. `start_pairing`/`finish_pairing` currently return an explicit S04-unavailable error. `UpdateStore::pin` and `Engine::receive_remote_change` are trusted-host APIs, not authentication endpoints: a supplied peer ID alone proves nothing. S04/S05 must enforce pairing and TLS before calling them.

Change envelope v1 has a version, SHA-256 content ID and 1–262,144 opaque payload bytes. The digest covers a domain separator, version and payload. The application must put document ID and operation identity inside the payload. Envelope validation checks version, length and digest; it cannot validate app/CRDT semantics. De-duplication is global by content ID. SQLite uses WAL and FULL synchronous writes; sequence numbers order local ingestion only. A peer cursor refers to this sender's log, advances monotonically only within its durable head, and must advance only after a remote durable acknowledgement. Received changes are kept for forwarding to other peers. No compaction or log quota exists yet.

Remote broadcast notifications are bounded hints (128 entries). A lagging subscriber must recover through `changes_after`; SQLite is the source of truth. Revocation removes the peer and cursor but keeps changes. Future database schemas are refused. The crate docs (`cargo doc -p zenith-sync --no-deps`) describe this boundary.

### Outstanding engineering risks

- Pairing and TLS are still design requirements, not implemented protections. The host must not expose pin/receive methods to untrusted input. Certificate possession must be verified in TLS as well as matching the stored pin.
- Rotating discovery tokens need a specified shared-secret recognition scheme; certificates and device IDs are public, so they cannot supply that secret. Token rotation alone does not hide IP addresses, ports, timing or stable mDNS hostnames. The discovery privacy goal is limiting advertised identity, not network anonymity.
- Per-peer cursors are sender-local durable acknowledgements, not CRDT version vectors. S05 must specify resume and acknowledgement ordering and test mid-transfer failures before advancing them.
- The append-only log has no retention bound or compaction mechanism yet. S03 must measure growth and preserve causality/tombstones when deciding compaction. Application validation, memory limits and quotas still need design work for hostile paired peers.
- Real exported-data migration, JS/Rust interoperability, merge policy, transport throughput and real-device/network behaviour have not been tested. No merge library has been chosen and no benchmark numbers have been measured.

S02 is merged (f77ff76). Work continues in the standalone `zenith-codex-sync` clone on `feat/sync-merge-model`; the earlier linked-worktree Git blocker is resolved. Its 8 baseline tests passed again with `cargo test -p zenith-sync --offline`, without registry overrides or network workarounds. S03 is in progress; S04/S05 and S07 are not started. Nothing here claims that the engine is secure or ready to sync user data.

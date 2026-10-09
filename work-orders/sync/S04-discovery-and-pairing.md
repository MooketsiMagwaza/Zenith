# S04 — Discovery, pairing and attempt limits

State: In progress (S04 library implemented and loopback checks passed, 9 October 2026; real-machine/network acceptance deferred to S07)

## Goal

Devices on one network find each other and pair once, safely, with no account.

## Scope

- Discovery with mDNS and DNS-SD (`_zenith-sync._tcp`), a UDP multicast fallback, and manual address entry. Announcements carry a rotating token and a port only. Unpaired devices are discoverable only while the pairing screen is open.
- Pairing: a QR code and six-digit code, a password-authenticated key exchange (SPAKE2 or CPace) or a short-string comparison, and storing the other device's pinned certificate fingerprint.
- Revoking a device.
- Limits: five wrong codes lock pairing for five minutes; a pairing window lasts about two minutes; a cap on concurrent connections and on frame size.
- Tests: a wrong code never pairs; a replayed pairing message fails; a locked device refuses until the lock ends; an unpaired device cannot read anything.

## Done when

- Two instances on one machine pair and then recognise each other after a restart. (Run and recorded.)
- The attacks listed in the threat model each have a test that tries them and fails.
- Pairing across two real machines on one Wi-Fi works, and one network that blocks mDNS is tried and the result recorded.

## Evidence, 9 October 2026

- `cargo test -p zenith-sync --offline`: 20 passing tests (2 pairing units, 6 S04 integrations, 12 existing S02/S03). The property test still runs 96 cases against both merge libraries. Debug symbols and incremental compilation disabled to limit disk use.
- SPAKE2 0.4.0 (RustCrypto), asymmetric initiator/acceptor roles. Certificates and fresh 256-bit nonce bind PAKE identities; HKDF binds both messages, certificates and nonce and separates client/server confirmations from discovery secrets. HMAC verification uses the crate's constant-time verification. Public certificates are visible during explicit pairing; no update-log API exists on this endpoint.
- Generated six-digit code; monotonic 120-second window; explicit cancellation; one concurrent exchange; bounded 9 KiB frames, 10-second frame and 30-second exchange deadlines. Attempts are reserved before any response/crypto, durably in SQLite schema v2; five attempts impose a five-minute lock. New windows and restart do not reset the budget. A unit test advances an injected store timestamp through lock expiry; the production window uses Instant.
- Two TCP instances on separate localhost ports paired, restarted with the same pins/secrets, recognised rotating tokens, and revoked. Wrong codes, raw transcript replay, role/certificate/nonce/transcript substitution, closed/expired windows, excessive frame lengths, malformed discovery packets and lock persistence were rejected. Unpaired code guesses received no changes; S05 must also reject them at the TLS data endpoint.
- DNS-SD registered and resolved between two daemons restricted to IPv4 loopback. UDP announcement codec round-tripped on separate localhost ports. IPv4 TTL=1 multicast socket and DNS-SD helpers are implemented; actual multicast fallback transmission is not yet tested. Numeric IPv4/IPv6 manual entry tested without DNS.
- Interface change: remove unavailable `finish_pairing(&[u8])`; use `pairing::connect`/`accept`. Host owns listeners, opt-in, address choice and discovery refresh. No UI/QR rendering or app integration; S06 must keep the code private and refresh advertisements on rotation/window close/revocation.
- RustCrypto explicitly reports no third-party audit: [SPAKE2 README](https://github.com/RustCrypto/PAKEs/blob/master/spake2/README.md). Neither the crate nor this confirmation composition is claimed secure/audited. Clock jumps can affect persisted lock duration and discovery recognition. Network attackers can consume the attempt budget and deny pairing. A lost final confirmation can leave one side pinned; locally revoke and retry.
- No real devices, blocked-mDNS network, hostile LAN, Windows firewall/ACL audit or CI run. S07 remains Not started. Pins/secrets are generated only at runtime; no key/certificate/secret fixture is committed.

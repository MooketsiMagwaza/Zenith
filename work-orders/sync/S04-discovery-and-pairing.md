# S04 — Discovery, pairing and attempt limits

State: Not started

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

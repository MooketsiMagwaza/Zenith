# S01 — Design the cross-device sync

State: In progress (a design draft is in [`docs/SYNC.md`](../../docs/SYNC.md); waiting for the owner's answers to its four open questions)

## Goal

Decide how two or more of your own devices keep one set of Zenith data in step with no account, no server and no internet, in the way Syncthing and LocalSend work.

## Scope

- Identity, pairing, discovery, transport, merge rules and a threat model, written down and argued.
- The four open questions in `docs/SYNC.md`: one app with two windows or two apps; first-version scope; a hosted relay later; whether the hosted platform work stays as a showpiece.

## Done when

- The owner has answered the open questions and the answers are recorded in `docs/SYNC.md`.
- Each later work order (S02 to S07) says which part of the design it builds.

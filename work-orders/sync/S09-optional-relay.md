# S09 — An optional relay for devices on different networks (later, only if wanted)

State: Not started (not planned; waits for the owner)

## Goal

Let paired devices sync when they are not on the same network, without an account and without the relay being able to read anything.

## Sketch

A small relay that forwards already-encrypted traffic between two paired devices that both dial out to it, like Syncthing's relays. It knows device tokens and byte counts, never contents. It is where rate limiting, metrics and an admin view would genuinely matter, so X02 to X04 would return in full if it is built.

## Done when

- The owner decides whether it is wanted. If not, this work order is closed.

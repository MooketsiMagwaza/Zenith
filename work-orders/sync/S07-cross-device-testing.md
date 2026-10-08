# S07 — Testing on real devices and bad networks

State: Not started

## Goal

Find out how sync behaves on real machines and ordinary networks before anyone relies on it.

## Scope

- Two or more real devices on one Wi-Fi: pair, edit on both, edit while one is asleep, edit while one is offline for days, and bring them back.
- Hostile conditions: a network that blocks mDNS and multicast, a guest network that isolates clients, a firewall prompt on Windows, a clock that is minutes wrong, a device renamed, a device wiped and re-paired.
- A written test log with dates, devices, what happened, and what was fixed.

## Done when

- The log exists, and each failure has either a fix or a documented limit in the README.

# X02 — Rate limiting

State: Not started

## Goal

No one client can overload the API or guess passwords, and a limited client is told clearly and recovers on its own.

## Design

- **Buckets:** a token bucket per key, stored in PostgreSQL (or Redis later) so limits hold across several API processes. Keys: client IP for anonymous routes, account id for signed-in routes, and email plus IP for login.
- **Limits (first cut, tuned from measurements):** login 5 failures per 15 minutes per email and IP, then a growing delay; register 10 per hour per IP; sync 60 requests per minute per account; everything else 120 per minute per IP.
- **Responses:** HTTP 429 with `Retry-After` and a stable error body. Clients back off with jitter and never retry in a tight loop.
- **Fail closed on auth, fail open on reads:** if the limiter store is down, login and register refuse; plain reads continue and the failure is counted.
- **Metrics:** requests allowed and limited by route and rule, and the limiter's own latency (see X03).

## Done when

- A test hammers each rule past its limit and sees 429, then sees the limit lift after the window. Each guard is shown failing when deliberately broken and passing when restored. (Run and recorded.)

# X04 — An admin dashboard

State: Not started

## Goal

The owner can see the health and use of the platform, and act on abuse, without database access.

## Design

- **App:** `apps/admin`, a small React app behind an admin role and a second factor, served separately from the public app.
- **Views:** platform health (linking to Grafana), accounts (search, disable, delete on request, never reading journal text), limiter activity (blocked clients, with the option to lift or extend a block), sync conflicts, and an audit log of every admin action with who did it.
- **Privacy:** the dashboard shows counts and ids, not what people wrote. Deleting an account is a logged action with a reason.
- **Look:** the same quiet black canvas as the app.

## Done when

- An admin can disable an account and lift a rate-limit block, each leaving an audit entry, and a non-admin gets a 403. (Run and recorded.)

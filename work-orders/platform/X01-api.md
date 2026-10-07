# X01 — A sync API with accounts

State: Not started

## Why

The web app keeps data in the browser and the pop-up keeps it in a file, so the same person cannot see one set of decks in both. An optional sync API fixes that. It also gives the platform work (rate limiting, observability, an admin dashboard) something real to protect and measure.

## Design

- **Stack:** Python and FastAPI with PostgreSQL, the same shape as other projects of mine, so the operational pattern is familiar. The code is written fresh here; only the pattern is reused. (Anything copied from another project needs its owner's and licence's check first. Tsela's code is moving to a company.)
- **Accounts:** email and password, hashed with Argon2, short-lived access tokens and refresh tokens, and a way to delete the account and export the data. No third-party tracking.
- **State model:** the client sends the changes since the last sync, not the whole state. Each record carries an id, an updated-at, and a deleted flag, and the server keeps the newest. Journals merge by timestamp and keep the older text in a history table so no write silently destroys another.
- **Endpoints (first cut):** `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/refresh`, `GET /v1/sync?since=`, `POST /v1/sync`, `DELETE /v1/account`, `GET /v1/export`, `GET /healthz`, `GET /readyz`, `GET /metrics`.
- **Optional by design:** both apps work fully offline and signed out. Sync is a setting, off by default, and the apps say what leaves the device.

## Done when

- Two clients can sync one account and converge after edits on both while offline, with tests for the merge rules.
- Account deletion removes the data, and an export returns it. (Run and recorded.)

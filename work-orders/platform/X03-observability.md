# X03 — Metrics, traces, logs, and Grafana dashboards

State: Not started

## Goal

When the API misbehaves, one dashboard shows where, and an alert says so before a person notices.

## Design

- **Stack, in `ops/`:** Prometheus scrapes the API; Grafana shows it with dashboards provisioned from files (so a fresh machine has them); Tempo stores traces; the API sends traces with OpenTelemetry. One `compose` file brings it all up beside the API and the database.
- **Metrics:** request count, latency histogram, and in-flight requests by route and status; limiter decisions (X02); sync batch size and conflicts; database pool use; account counts by day. Labels stay bounded: route templates, never raw paths or user ids.
- **Logs:** structured JSON with a request id that also appears in the response header and the trace, and no passwords, tokens, or journal text.
- **Dashboards:** an API overview (rate, errors, latency percentiles), a limiter board (who is being limited and by which rule), a sync board (batch size, conflicts), and a database board.
- **Alerts:** error rate, latency, limiter store down, and database pool exhaustion, each with a test that proves the rule fires.

## Done when

- `docker compose up` shows live data on all four dashboards, and each alert has been seen to fire on a deliberate fault. (Run and recorded.)

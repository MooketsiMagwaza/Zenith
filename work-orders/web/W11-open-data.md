# W11 Open data

State: **Not started**

## Scope

Document a versioned format in docs/DATA_FORMAT.md. Export/import full JSON, CSV time entries, Markdown journals and iCalendar. Import Toggl/Clockify CSV using labelled invented fixtures. Explain plainly that your data is yours.

## Acceptance and evidence

Saved pre-change export migration regression; round trips and malformed/future-version rejection; CSV importer fixtures. Preserve original keys and values. No network calls.

No implementation or validation yet. The batch stopped at W06 because Git metadata is read-only in the execution environment; the owner requires a local commit after each green step. Resume in order after committing the reviewed W06 changes.

# P05 The desktop pet

State: **Not started**

## Scope

Opt-in animated companion in apps/popup, using the existing store and window shell. Original SVG/CSS art. Idle, focus, break, celebration and nudge reactions, companion speech, dragging and click to open the app. Reduced-motion alternative. Keep Rust changes small and only when necessary.

## Acceptance and evidence

Popup build; store migration test; opt-in/reaction and reduced-motion checks. Native window dragging and app-open behavior require a real desktop run.

No implementation or validation yet. The batch stopped at W06 because Git metadata is read-only in the execution environment; the owner requires a local commit after each green step. Resume in order after committing the reviewed W06 changes.

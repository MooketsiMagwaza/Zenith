# W09 Pomodoro

State: Implemented in code on 9 October 2026; integration/manual checks open.

Checked by the assistant on 25 October 2026, outside the Codex sandbox: the app tests pass (37 tests across W06 to W11), the pop-up tests pass (7), and the app, pop-up and marketing production builds pass. Not verified: the feature in a browser, on a phone, or in the desktop window (focus rings, contrast, reduced motion, notifications and sounds).

## Delivered

Opt-in 25/5 and 50/10 presets, custom focus/break/long-break lengths, a long break after four focus blocks, manual phases and optional auto-start. Ctrl/Command + Alt + P opens Pomodoro and starts a waiting phase outside text inputs. Focus uses the existing logger, ending at its deadline; breaks never accrue card time. Companion phrases and completion screens are reused. A separately versioned `zenith.pomodoro.v1` runtime survives normal reload; settings extend `zenith.features.v1` additively.

Suspension settles only the active focus block, then starts the next phase from return. Switching to another timer cancels the cycle. Ending a cycle logs partial focus, capped at the deadline. Removed targets cancel it. Future/unreadable runtime remains preserved.

## Evidence

Both apps pass `npx --offline tsc --noEmit -p apps/<app>`. Offline runner: 20 test bodies passed, including eight-block cycles, manual and auto phases, presets/custom durations, suspension, matching-session/deadline guards, malformed/future-version runtime and additive settings migration. In-process local source bundles pass for both apps. Handoff: `.verification/commit-W09.txt` and per-order snapshots (Git/.codex read-only).

## Open checks and decisions

Real Vitest/Vite, actual React timer/logging transitions, reload/background suspension, shortcut and browser/desktop interactions must be checked outside the sandbox. When any completion-screen part is enabled, auto-start yields to manual phase start so a focus block cannot silently begin behind a recap. This interaction is stated in the UI. Normal reload is handled, but persistence across the separate session/runtime keys is not a crash-atomic transaction. No sound added. The popup has its own independent state and does not share this timer.

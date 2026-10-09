# W12 — Present Zenith as open source

State: Done for the licence and the copy on 9 October 2026; the open-data promise waits for W11

## Goal

Zenith is open source under a real licence, and the README and the marketing site say so truthfully.

## Decision

The owner chose the **MIT licence** on 9 October 2026, out of MIT, Apache-2.0, AGPL-3.0 and keeping all rights reserved.

## Done

- `LICENSE` (MIT, copyright 2026 Mooketsi Vincent Magwaza) at the repository root.
- The README licence section and intro, the marketing site's footer and download page, and the `license` field in every `package.json` and `Cargo.toml` now say MIT. The old "all rights reserved" wording is gone.
- The marketing site builds. (See the pull request for the run.)

## Still to do

- Say "easy access to your data in open formats" only once W11 (export and import in documented formats) exists. Until then the README says it is planned and not built.
- Add a short `CONTRIBUTING.md` and a code of conduct if the owner wants outside contributions.
- Bundled third-party material keeps its own licence: DM Sans is under the SIL Open Font License, and npm and crate dependencies carry theirs. Run a licence check (for example `cargo deny` and a JavaScript licence report) before the first tagged release and record the result here.
- Update the portfolio and the profile README, which describe Zenith as all rights reserved if they say anything about the licence.

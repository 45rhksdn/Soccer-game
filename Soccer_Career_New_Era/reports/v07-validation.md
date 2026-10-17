# v0.7 validation — in progress

Base: Claude `358ede2567cab39ac578fe9c920c9742c219a83d`, PR #5.

- TypeScript + production/PWA build: passed.
- New tactical tests: 10 passed (probability envelopes, crowd penalty, target/direction, defense outcomes, grouped training, v6 migration, determinism).
- 32-year peak regression: passed, tested career peak 69.5 at age 32; strongest top-league player 84.8.
- Initial regression run identified outdated v6 equality/label assertions, pass-assist continuation and shooting-volume issues; fixes are under revalidation.
- New Playwright v07 scenarios added. Local browser QA unavailable under the managed Sites workflow; GitHub CI will run desktop/mobile Chromium and WebKit.
- No claim of completed browser verification or final balance in this checkpoint.

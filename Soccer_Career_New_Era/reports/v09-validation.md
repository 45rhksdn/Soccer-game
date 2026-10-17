# v0.9 validation — in progress

Base: Claude v0.8 `f36d1e3245593d5f98f751e1b8dae711061994d0` (PR #8).

- Added 11 pro leagues, 66 fictional pro clubs, 6 schools (72 clubs / 1,440 roster slots).
- TypeScript and production build passed.
- Initial focused run: 31 tests passed (league calibration, 30-year world accounting, offers, scouting, loan roundtrip, v7 expansion, existing v5 saves and season integration), 24.34 seconds.
- Browser tests added for league browsing, target/preference persistence, offer details, loan acceptance and reload. GitHub CI pending.
- Full regression and long-career growth verification pending. No publication claimed.

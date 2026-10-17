# STOP CHECKPOINT — final local result

User requested stopping after the current fix and handing off to Claude. No v0.7 deployment.

**Known failing gate, do not mark complete:** after restoring shooting-lane blocking, `tests/chance-flow.test.ts` fails expected assists >5: measured **3.847**, across 200 matches (2,753 passes, 1,781 completed, 45 key passes, 4 assists). The threshold was NOT relaxed. `reports/chance-flow.json` records this latest result. Next work: improve receiver positioning/pass selection while retaining truthful shot probabilities, then rerun balance.

Final local checks: production/PWA build passed; midfielder+tactical **18 tests passed**, chance-flow **1 failed** (22.91 seconds). This last code change has not completed full regression/browser checks. Earlier full remainder run had 94 passes and one shooting-lane failure, now fixed by those targeted tests.

Browser smoke for preceding commit `0720084`: desktop/mobile Chromium and iPhone-profile WebKit both passed in CI `39013002276`. Full CI was still running at handoff; inspect GitHub for subsequent results. The latest commit will start its own CI.

Everything below is evidence from BEFORE the last shooting-lane fix; those numeric balance results must not be presented as final.

---

# v0.7 validation — browser CI in progress

Source base: Claude `358ede2567cab39ac578fe9c920c9742c219a83d` (PR #5). Implementation PR #6.

## Executed local checks (2026-10-17)

- TypeScript + Vite/PWA production build: passed.
- Tactical, engine and chance-flow: 22/22 passed, 61.12 seconds.
- Aging, retirement and defensive choices: 16/16 passed, 88.50 seconds. No RPC timeout errors after yielding the event loop during long simulations.
- 200-match balance: passed, 22.39 seconds. Mean 3.165 goals / 28.21 shots, home 1.530 / away 1.635. Positional means GK 6.658, LB 6.335, CB 6.239, RB 6.376, CM 6.791, LW 6.664, ST 6.769, RW 6.599. Spread 0.552; declared limit 0.9.
- 200-match CM pass flow: 2,638 attempts, 1,783 completions, 70 key passes, 5.869 expected assists, 7 assists. This measures the scripted forward-pass policy, not all possible player tactics.
- Career 16→35: peak ability 69.0 at age 32, 67.6 at 35; strongest top-league player 84.5. This ordinary-growth sample verifies age shape, not elite-player equivalence.
- Save v6→v7 tests cover player, NPC and in-progress match attributes; deterministic state restoration passes.

## Browser validation

- Initial CI identified repeated/consecutive goal alerts. Alerts now group pending goal events and acknowledge them in both session state and saved match data.
- GitHub CI runs actual desktop/mobile Chromium and iPhone-profile WebKit. The new goal test checks dismissal and reload.
- Latest source at report creation: `0720084426088c68f03cfeaeb7c6e82f92a6c2c3`; CI still running. Do not claim final browser completion until results are recorded.
- Managed local browser QA is unavailable; no local browser test is claimed. WebKit emulation is not a physical iPhone Safari test.

## Remaining limits

- Map pins represent regions rather than surveyed campus coordinates.
- Popup reference image was not attached; original classic gray/blue styling is used.
- Full 2,000-match CI and browser/PWA completion remain the publication gates.

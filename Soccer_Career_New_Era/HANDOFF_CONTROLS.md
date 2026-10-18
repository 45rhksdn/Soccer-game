# Compact match UI — Codex, 2026-10-18

Base: claude/v0.14-finish-assist @ 4f101c659560f6104fd459e1e433cf128d7ea0f0.
Branch: codex/compact-match-controls. Claude v0.15 is in progress; no v0.15 branch was visible when work started.

## Integration boundaries
- No engine.ts, tactical.ts, career rules, storage schema or version-number edits.
- MatchInteraction.tsx keeps its former implementation as LegacyMatchInteraction and re-exports CompactMatch as the production MatchInteraction. Apply this small wiring change last if Claude also changes the old UI.
- New CompactMatch.tsx / compact-match.css hold the compact dark navy / mint UI, always-ready direction pad, route warning (!), probability gauges, pass target confirmation and shot selection/confirmation.
- Pitch.tsx adds optional premium + selectedTarget props, pass gauges and selected target path. Existing coordinate conversion and Claude carry interpolation are preserved. Offside targets cannot be confirmed.
- Existing cross, cutback, header, volley actions remain available. Aerial reception opens shot controls; corner opens passing controls. Off-ball and defense controls preserved. Ball shielding not added.
- `routeBlocked` is a visual corridor check (1.5 m wide on either side, forward only, engine-planned carry length). It is not an additional success penalty. Probability comes directly from attackOdds / defenseOdds. UI queries consume no RNG.
- Match commentary is above controls; goals/assists/lucky/insight popup handling in App stays unchanged. Missions are collapsed below toolbar.
- Save data is unchanged. Existing match state still uses the same simulation and persistence callbacks.

## Verification
- Production build passed.
- 25 focused engine tests passed: dribble-pace, dribble-reward, matchup.
- New Playwright workflow checks PC Chromium, phone Chromium and iPhone-profile WebKit, saves screenshots. Results recorded after execution.
- Historical UI tests updated where the interaction contract intentionally changed (no cancel-pad step, pass and shot confirmation).
- No claim of a physical iPhone test or complete season balance retest.

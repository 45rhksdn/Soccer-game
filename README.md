# Soccer Career — New Era (handoff)

This is the private repository for the soccer career game developed in ChatGPT Work and continued with Claude Opus.

## Important
- The game source lives in [`Soccer_Career_New_Era/`](Soccer_Career_New_Era/). Start with [`Soccer_Career_New_Era/HANDOFF.md`](Soccer_Career_New_Era/HANDOFF.md).
- `main` holds the unmodified v0.3 snapshot (2026-10-16 ZIP). Development continues on branches merged through pull requests:
  - `claude/v0.3.1-fixes` — bug fixes and cleanup (PR #1)
  - `claude/v0.4-traits-scouting` — multiple traits, real high-school scouting, player switching (save format v5)
- Run `npm ci`, `npm run build`, `npm test` and `npm run test:e2e` inside `Soccer_Career_New_Era/`. GitHub Actions runs them on every push.
- Do not overwrite later Work changes with these branches without reviewing diffs. The live Work deployment may contain changes (e.g. its own player-switch feature) that are not in this repository yet.

## Key outstanding work
Items 1–3 and 5 of the original list are implemented on `claude/v0.4-traits-scouting`; see the checklist in HANDOFF.md. Still open:
1. Merge with the newest Work source once available (including its player-switch feature) and reconcile save keys.
2. Real iPhone Safari testing.
3. NPC injury model, broader school catalogue, optional scouting limits.

## Recommended workflow
Create feature branches for Claude and Work; merge through reviewed pull requests. Update `HANDOFF.md` after each change. Never commit API keys or secrets.

import { it, expect } from "vitest";
import { createMatch, attributes, finishMatch, rating } from "../src/engine";
import { writeFileSync, mkdirSync } from "node:fs";
const count = Number(process.env.BALANCE_MATCHES ?? 2000);
it("seeded matches: invariants and declared calibration targets", async () => {
  const start = performance.now();
  let goals = 0,
    shots = 0,
    home = 0,
    away = 0,
    zero = 0;
  let maxGoals = 0,
    minShots = Infinity,
    maxShots = 0;
  const ratings: Record<string, number[]> = {};
  for (let seed = 1; seed <= count; seed++) {
    if (seed % 100 === 0) await new Promise((r) => setTimeout(r, 0));
    const m = finishMatch(
      createMatch(
        seed,
        { name: "테스트", pos: "CM", a: attributes(46), energy: 100 },
        46,
      ),
    );
    const g = m.score[0] + m.score[1],
      s = m.shots[0] + m.shots[1];
    goals += g;
    shots += s;
    home += m.score[0];
    away += m.score[1];
    zero += g === 0 ? 1 : 0;
    maxGoals = Math.max(maxGoals, g);
    minShots = Math.min(minShots, s);
    maxShots = Math.max(maxShots, s);
    expect(m.ended).toBe(true);
    expect(m.players.reduce((sum, p) => sum + p.stats.goals, 0)).toBe(g);
    for (const p of m.players) {
      expect(Number.isFinite(p.x) && p.x >= 0 && p.x <= 105).toBe(true);
      expect(p.y >= 0 && p.y <= 68).toBe(true);
      expect(p.stats.completed).toBeLessThanOrEqual(p.stats.passes);
      (ratings[p.pos] ??= []).push(rating(p));
    }
  }
  const result = {
    matches: count,
    meanGoals: goals / count,
    meanShots: shots / count,
    homeGoals: home / count,
    awayGoals: away / count,
    scoreless: zero,
    maxGoals,
    shotsRange: [minShots, maxShots],
    ratingByPosition: Object.fromEntries(
      Object.entries(ratings).map(([k, v]) => [
        k,
        v.reduce((a, b) => a + b, 0) / v.length,
      ]),
    ),
    seconds: (performance.now() - start) / 1000,
    targets: { meanGoals: [1.5, 4.5], meanShots: [14, 38] },
  };
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/balance.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  expect(result.meanGoals).toBeGreaterThanOrEqual(1.5);
  expect(result.meanGoals).toBeLessThanOrEqual(4.5);
  expect(result.meanShots).toBeGreaterThanOrEqual(14);
  expect(result.meanShots).toBeLessThanOrEqual(38);
  const means = Object.values(result.ratingByPosition);
  expect(Math.max(...means) - Math.min(...means)).toBeLessThan(0.9);
}, 240000);

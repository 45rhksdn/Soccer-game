import { describe, it, expect } from "vitest";
import {
  createMatch,
  attributes,
  finishMatch,
  step,
  act,
  availableActions,
  shotQuality,
  rating,
  defend,
} from "../src/engine";
import { newCareer, train, settle } from "../src/career";
import { encode, decode } from "../src/storage";
const user = {
  name: "테스트",
  pos: "CM" as const,
  a: attributes(52),
  energy: 100,
};
const player = {
  name: "테스트",
  age: 16,
  pos: "CM" as const,
  secondary: "ST" as const,
  foot: "오른",
  height: 178,
  weight: 70,
  style: "플레이메이커",
  curve: "꾸준한 성장형",
};
describe("deterministic engine", () => {
  it("same seed and actions yield exact state", () => {
    expect(finishMatch(createMatch(42, user))).toEqual(
      finishMatch(createMatch(42, user)),
    );
  });
  it("save mid-match and resume produce exact final state", () => {
    const c = newCareer(player, 0);
    c.match = createMatch(1337, user);
    for (let i = 0; i < 400; i++) step(c.match, 0.5, true);
    const restored = decode(encode(c));
    expect(finishMatch(c.match)).toEqual(finishMatch(restored.match!));
  });
  it("user possession pauses clock until a legal decision", () => {
    const m = createMatch(20, user);
    let i = 0;
    while (!m.decision && !m.ended && i++ < 10000) { if (m.defending) defend(m, "none"); step(m); }
    expect(m.decision).toBe(true);
    const t = m.clock;
    step(m);
    expect(m.clock).toBe(t);
    act(m, availableActions(m)[0]);
    expect(m.decision).toBe(false);
    step(m);
    expect(m.clock).toBeGreaterThan(t);
  });
  it("long-range shots restricted, near goal skill and pressure affect chance", () => {
    const m = createMatch(2, user),
      p = m.players[m.userId];
    m.ball.owner = p.id;
    p.x = 5;
    expect(availableActions(m)).not.toContain("shoot");
    p.x = 90;
    p.y = 34;
    const low = shotQuality(m, p);
    p.a.shooting = 95;
    expect(shotQuality(m, p)).toBeGreaterThan(low);
  });
  it("training consumes days, grows attributes, enforces limits", () => {
    const c = newCareer(player, 0);
    const initial = c.player.a.passing;
    train(c, "passing", 1);
    expect(c.player.a.passing).toBeGreaterThan(initial);
    expect(c.player.energy).toBe(91);
    train(c, "rest", 1);
    expect(c.player.energy).toBe(100);
    train(c, "passing", 1);
    expect(() => train(c, "passing", 1)).toThrow();
  });
  it("diminishing returns and potential cap", () => {
    const c = newCareer(player, 0);
    c.player.a.passing = c.player.potential - 0.001;
    train(c, "passing", 1.4);
    expect(c.player.a.passing).toBeLessThanOrEqual(c.player.potential);
  });
  it("result recorded once; next week playable", () => {
    const c = newCareer(player, 0);
    c.match = finishMatch(createMatch(44, user));
    const score = [...c.match.score];
    settle(c);
    expect(c.history).toHaveLength(1);
    expect(c.history[0].score).toEqual(score);
    expect(c.week).toBe(1);
    expect(c.trainingCount).toBe(0);
    expect(() => settle(c)).toThrow();
    train(c, "rest", 1);
  });
  it("corruption and unknown versions rejected", () => {
    const c = newCareer(player, 0);
    expect(() => decode(encode(c).replace("테스트", "변조"))).toThrow();
    expect(() => encode({ ...c, version: 99 } as any)).toThrow();
  });
  it("version one migrates", () => {
    const c = newCareer(player, 0);
    const raw = { ...c, version: 1 };
    const migrated = decode(encode(raw as any));
    expect(migrated.version).toBe(7);
  });
  it("100 week progression stays finite and within potential", () => {
    const c = newCareer(player, 0);
    for (let i = 0; i < 100; i++) {
      train(c, "passing", 1);
      train(c, "rest", 1);
      c.match = finishMatch(createMatch(i, { ...user, a: c.player.a }));
      settle(c);
    }
    expect(c.history).toHaveLength(100);
    expect(c.player.a.passing).toBeLessThanOrEqual(c.player.potential);
    expect(Number.isFinite(c.player.trust)).toBe(true);
  });
  it("team ability changes actual results across paired seeds", () => {
    let strong = 0,
      weak = 0;
    for (let i = 1; i <= 80; i++) {
      const m = createMatch(i, user, 35);
      for (const p of m.players) if (p.team === 0) p.a = attributes(75);
      finishMatch(m);
      strong += m.score[0];
      weak += m.score[1];
    }
    expect(strong).toBeGreaterThan(weak * 1.3);
  });
});

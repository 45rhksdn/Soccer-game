import { useEffect, useRef } from "react";
import { direction, type Match } from "./engine";
import {attackOdds,offside} from "./tactical";

// 0.8: the live match is drawn vertically and always shows the user's team attacking upward,
// so the whole pitch fits one phone screen. The home-page ambient pitch stays horizontal.
const PITCH_L = 105, PITCH_W = 68;
type View = { w: number; h: number; s: number; ox: number; oy: number; vertical: boolean; up: boolean };
function view(vertical: boolean, up: boolean): View {
  const w = vertical ? 650 : 1000, h = vertical ? 1000 : 650, pad = 30;
  const s = vertical ? Math.min((w - pad * 2) / PITCH_W, (h - pad * 2) / PITCH_L) : Math.min((w - pad * 2) / PITCH_L, (h - pad * 2) / PITCH_W);
  const fw = (vertical ? PITCH_W : PITCH_L) * s, fh = (vertical ? PITCH_L : PITCH_W) * s;
  return { w, h, s, ox: (w - fw) / 2, oy: (h - fh) / 2, vertical, up };
}
/** Engine metres → canvas pixels. */
function toCanvas(v: View, x: number, y: number): [number, number] {
  if (!v.vertical) return [v.ox + x * v.s, v.oy + y * v.s];
  return v.up ? [v.ox + y * v.s, v.oy + (PITCH_L - x) * v.s] : [v.ox + (PITCH_W - y) * v.s, v.oy + x * v.s];
}
/** Canvas pixels → engine metres. */
function toEngine(v: View, cx: number, cy: number): [number, number] {
  const u = (cx - v.ox) / v.s, w = (cy - v.oy) / v.s;
  if (!v.vertical) return [u, w];
  return v.up ? [PITCH_L - w, u] : [w, PITCH_W - u];
}
/** The user's team attacks toward the top of the vertical pitch. */
const attacksUp = (m: Match) => direction(m, m.players[m.userId].team) > 0;
/** A direction on screen (right = +x, down = +y) as an engine movement vector. */
export function screenToEngineVector(m: Match, sx: number, sy: number) {
  return attacksUp(m) ? { x: -sy, y: sx } : { x: sy, y: -sx };
}

export type PitchMotion={from:Record<number,{x:number,y:number}>;started:number;duration:number};
export function Pitch({
  match,
  ambient = false,
  vertical = !!match,
  selectable = false,
  onPlayer,
  dribble = false,
  onDribble,
  selectedTarget = null,
  premium = false,
  motion = null,
}: {
  selectedTarget?: number | null;
  premium?: boolean;
  motion?: PitchMotion|null;
  match?: Match | null;
  ambient?: boolean;
  vertical?: boolean;
  selectable?: boolean;
  onPlayer?: (id: number) => void;
  /** Dribble mode: tapping the pitch picks the direction. */
  dribble?: boolean;
  onDribble?: (vector: { x: number; y: number }) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // 0.13 what is drawn eases toward the engine positions, so a dribble's carry (several seconds of play at once)
  // shows everyone moving rather than jumping. Kick-offs and other jumps over 25 m snap.
  const shown = useRef(new Map<number, { x: number; y: number }>());
  const v = view(vertical, match ? attacksUp(match) : true);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      c.width = v.w;
      c.height = v.h;
      ctx.fillStyle = premium ? "#102c2b" : "#1d5c46";
      ctx.fillRect(0, 0, v.w, v.h);
      const P = (x: number, y: number) => toCanvas(v, x, y);
      const ease = (id: number, x: number, y: number) => {
        if(motion&&motion.from[id]){const progress=Math.min(1,(performance.now()-motion.started)/motion.duration),f=motion.from[id];const pos={x:f.x+(x-f.x)*progress,y:f.y+(y-f.y)*progress};shown.current.set(id,pos);return pos;}
        const s = shown.current.get(id);
        if (!s || Math.hypot(s.x - x, s.y - y) > 25) { const n = { x, y }; shown.current.set(id, n); return n; }
        s.x += (x - s.x) * 0.16; s.y += (y - s.y) * 0.16; return s;
      };
      const at = new Map<number, { x: number; y: number }>();
      if (match) for (const p of match.players) at.set(p.id, ease(p.id, p.x, p.y));
      const rect = (x1: number, y1: number, x2: number, y2: number, fill?: string) => {
        const [a, b] = P(x1, y1), [cc, d] = P(x2, y2);
        const x = Math.min(a, cc), y = Math.min(b, d), w = Math.abs(cc - a), h = Math.abs(d - b);
        if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); } else ctx.strokeRect(x, y, w, h);
      };
      // Mowing stripes across the length.
      for (let i = 0; i < 10; i++) rect(i * 10.5, 0, (i + 1) * 10.5, PITCH_W, premium ? (i % 2 ? "#174239" : "#19473d") : (i % 2 ? "#286e54" : "#24674f"));
      ctx.strokeStyle = "#cfe3cbb0";
      ctx.lineWidth = 2;
      rect(0, 0, PITCH_L, PITCH_W);
      const [h1x, h1y] = P(52.5, 0), [h2x, h2y] = P(52.5, PITCH_W);
      ctx.beginPath(); ctx.moveTo(h1x, h1y); ctx.lineTo(h2x, h2y); ctx.stroke();
      const [cx, cy] = P(52.5, 34);
      ctx.beginPath(); ctx.arc(cx, cy, 9.15 * v.s, 0, 7); ctx.stroke();
      ctx.fillStyle = "#d8e8cf";
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
      for (const end of [0, PITCH_L]) {
        const inward = end === 0 ? 1 : -1;
        rect(end, 13.84, end + inward * 16.5, 54.16);
        rect(end, 24.84, end + inward * 5.5, 43.16);
        rect(end, 30.34, end - inward * 1.6, 37.66, "#eef2e3aa");
        const [px, py] = P(end + inward * 11, 34);
        ctx.fillStyle = "#d8e8cf";
        ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
      }
      const players =
        match?.players ??
        Array.from({ length: 22 }, (_, i) => ({
          id: i,
          x: i < 11 ? 15 + (i % 4) * 13 : 90 - (i % 4) * 13,
          y: 10 + (i % 5) * 12,
          team: i < 11 ? 0 : 1,
          number: (i % 11) + 1,
          red: false,
          injured: false,
        }));
      const userTeam = match ? match.players[match.userId].team : 0;
      for (const p of players) {
        if (p.red || p.injured) continue;
        const q = (match && at.get(p.id)) || p, [x, y] = P(q.x, q.y),
          user = match ? p.id === match.userId && match.userOnPitch !== false : p.id === 9;
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 7, 11, 6, 0, 0, 7);
        ctx.fillStyle = "#09271b60";
        ctx.fill();
        if (user) {
          ctx.strokeStyle = "#f4f78a";
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.stroke();
          ctx.fillStyle = "#f4f78a";
          ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x - 6, y - 33); ctx.lineTo(x + 6, y - 33); ctx.fill();
        }
        if (selectable && match && p.team === userTeam && p.id !== match.userId) {
          ctx.strokeStyle = offside(match,match.players[p.id]) ? "#82948b" : "#70e3b6"; ctx.lineWidth = selectedTarget === p.id ? 5 : 2;
          ctx.beginPath(); ctx.arc(x, y, 23, 0, 7); ctx.stroke();
          if(!offside(match,match.players[p.id])){
            const chance=attackOdds(match,'pass',{targetId:p.id}).p;
            ctx.fillStyle='#122421';ctx.fillRect(x-20,y+36,40,5);
            ctx.fillStyle='#70e3b6';ctx.fillRect(x-20,y+36,40*chance,5);
          }
          if(selectedTarget===p.id){
            const u=match.players[match.userId],[ux,uy]=P(u.x,u.y);
            ctx.save();ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(ux,uy);ctx.lineTo(x,y);ctx.stroke();ctx.restore();
          }
        }
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 7);
        ctx.fillStyle = premium ? (p.team === userTeam ? "#d1f7e7" : "#e79e86") : (p.team === userTeam ? "#f2f1db" : "#e79562");
        ctx.fill();
        ctx.fillStyle = p.team === userTeam ? "#183c2e" : "#40251c";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(p.number), x, y + 0.5);
        if (match) {
          ctx.font = "bold 12px sans-serif"; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#123428"; ctx.lineWidth = 3;
          ctx.strokeText(match.players[p.id].name, x, y + 27); ctx.fillText(match.players[p.id].name, x, y + 27);
        }
      }
      // 0.10 the user's run in behind: a dashed arrow to where the through ball should go.
      if (match && match.userOnPitch !== false) {
        const u = match.players[match.userId];
        if (u.run && u.run.until > match.clock && match.ball.owner !== u.id) {
          const [ux, uy] = P(u.x, u.y), [rx, ry] = P(u.run.x, u.run.y);
          ctx.save(); ctx.strokeStyle = "#f4f78a"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
          ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(rx, ry); ctx.stroke(); ctx.setLineDash([]);
          const a = Math.atan2(ry - uy, rx - ux); ctx.fillStyle = "#f4f78a";
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 12 * Math.cos(a - .4), ry - 12 * Math.sin(a - .4)); ctx.lineTo(rx - 12 * Math.cos(a + .4), ry - 12 * Math.sin(a + .4)); ctx.fill();
          ctx.restore();
        }
      }
      // Dribble mode: eight arrows around the user; any tap on the pitch sets the direction.
      if (dribble && match) {
        const u = at.get(match.userId) ?? match.players[match.userId], [ux, uy] = P(u.x, u.y);
        ctx.fillStyle = "#ffd84ae6"; ctx.strokeStyle = "#1b3a2c"; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4, r = 46, ax = ux + Math.cos(a) * r, ay = uy + Math.sin(a) * r;
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
          ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -9); ctx.lineTo(-3, 0); ctx.lineTo(-7, 9); ctx.closePath();
          ctx.fill(); ctx.stroke(); ctx.restore();
        }
      }
      const b0 = match?.ball ?? { x: 53, y: 33 }, b = match ? ease(-1, b0.x, b0.y) : b0, [bx, by] = P(b.x, b.y);
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#19352b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, 7); ctx.fill(); ctx.stroke();
      if (ambient) { ctx.fillStyle = "#08271c44"; ctx.fillRect(0, 0, v.w, v.h); }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [match, ambient, selectable, dribble, selectedTarget, premium, motion, v.vertical, v.up]);
  const clickable = (selectable || dribble) && !!match;
  return (
    <canvas
      ref={ref}
      onClick={(e) => {
        if (!clickable || !match) return;
        const r = e.currentTarget.getBoundingClientRect();
        const cx = ((e.clientX - r.left) / r.width) * v.w, cy = ((e.clientY - r.top) / r.height) * v.h;
        if (dribble) {
          const u = match.players[match.userId], [ux, uy] = toCanvas(v, u.x, u.y);
          const sx = cx - ux, sy = cy - uy;
          if (Math.hypot(sx, sy) < 8) return; // a tap on the player itself is not a direction
          onDribble?.(screenToEngineVector(match, sx, sy));
          return;
        }
        const [x, y] = toEngine(v, cx, cy);
        const q = match.players
          .filter((p) => p.team === match.players[match.userId].team && p.id !== match.userId && !p.red && !p.injured)
          .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
        if (q && Math.hypot(q.x - x, q.y - y) < 5) onPlayer?.(q.id);
      }}
      className={`pitch${v.vertical ? " vertical" : ""}${clickable ? " clickable" : ""}`}
      role="img"
      aria-label={dribble ? "경기장을 눌러 드리블 방향을 정하세요" : "22명 선수와 공의 위치를 표시하는 실시간 축구 경기장 (우리 팀은 위쪽으로 공격)"}
      data-orientation={v.vertical ? "vertical" : "horizontal"}
    />
  );
}

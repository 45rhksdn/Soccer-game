import { useEffect, useRef } from "react";
import type { Match } from "./engine";
export function Pitch({
  match,
  ambient = false,
}: {
  match?: Match | null;
  ambient?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      const w = 1000,
        h = 650;
      c.width = w;
      c.height = h;
      ctx.fillStyle = "#22664e";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 ? "#286e54" : "#24674f";
        ctx.fillRect(35 + i * 93, 35, 93, 580);
      }
      const X = (x: number) => 35 + (x / 105) * 930,
        Y = (y: number) => 35 + (y / 68) * 580;
      ctx.strokeStyle = "#b5d6b68a";
      ctx.lineWidth = 2;
      ctx.strokeRect(35, 35, 930, 580);
      ctx.beginPath();
      ctx.moveTo(500, 35);
      ctx.lineTo(500, 615);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(500, 325, 81, 78, 0, 0, 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(500, 325, 3, 0, 7);
      ctx.fillStyle = "#c5dcb6";
      ctx.fill();
      for (const right of [false, true]) {
        ctx.strokeRect(right ? 819 : 35, 153, 146, 344);
        ctx.strokeRect(right ? 916 : 35, 246, 49, 158);
        ctx.fillStyle = "#e5e9da66";
        ctx.fillRect(right ? 965 : 23, 294, 12, 62);
        ctx.beginPath();
        ctx.arc(right ? 867 : 133, 325, 3, 0, 7);
        ctx.fill();
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
      for (const p of players) {
        if (p.red || p.injured) continue;
        const x = X(p.x),
          y = Y(p.y),
          user = match ? p.id === match.userId && match.userOnPitch !== false : p.id === 9;
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 7, 11, 6, 0, 0, 7);
        ctx.fillStyle = "#09271b60";
        ctx.fill();
        if (user) {
          ctx.strokeStyle = "#e9f58a";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 19, 0, 7);
          ctx.stroke();
          ctx.fillStyle = "#e9f58a";
          ctx.beginPath();
          ctx.moveTo(x, y - 23);
          ctx.lineTo(x - 5, y - 31);
          ctx.lineTo(x + 5, y - 31);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, 7);
        ctx.fillStyle = p.team === 0 ? "#f2f1db" : "#e79562";
        ctx.fill();
        ctx.fillStyle = p.team === 0 ? "#183c2e" : "#40251c";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(p.number), x, y + 0.5);
      }
      const b = match?.ball ?? { x: 53, y: 33 };
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#19352b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(b.x), Y(b.y), 5, 0, 7);
      ctx.fill();
      ctx.stroke();
      if (ambient) {
        ctx.fillStyle = "#08271c44";
        ctx.fillRect(0, 0, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [match, ambient]);
  return (
    <canvas
      ref={ref}
      className="pitch"
      role="img"
      aria-label="22명 선수와 공의 위치를 표시하는 실시간 축구 경기장"
    />
  );
}

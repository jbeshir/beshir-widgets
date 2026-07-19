import type { GameState } from "./types";
import { W, H } from "./simulation";
export function draw(c: HTMLCanvasElement, s: GameState) {
  const dpr = Math.min(devicePixelRatio || 1, 2),
    r = c.getBoundingClientRect();
  if (
    c.width !== Math.round(r.width * dpr) ||
    c.height !== Math.round(r.height * dpr)
  ) {
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
  }
  const x = c.getContext("2d")!;
  x.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
  const g = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 520);
  g.addColorStop(0, "#17274e");
  g.addColorStop(1, "#060817");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "#263766";
  x.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    x.arc(W / 2, H / 2, 60 + i * 55, 0, 7);
    x.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const px = (i * 137) % W,
      py = (i * 83) % H;
    x.fillStyle = i % 3 ? "#52658f" : "#b9f8ff";
    x.fillRect(px, py, i % 5 ? 1 : 2, i % 5 ? 1 : 2);
  }
  for (const q of s.shards) {
    x.save();
    x.translate(q.x, q.y);
    x.rotate(Math.PI / 4);
    x.fillStyle = "#9affc7";
    x.fillRect(-5, -5, 10, 10);
    x.restore();
  }
  for (const p of s.shots) {
    x.fillStyle = p.hostile ? "#ff648f" : "#7ff6ff";
    x.beginPath();
    if (p.kind === "mine") {
      x.strokeStyle = "#ffcf72";
      x.lineWidth = 2;
      x.arc(p.x, p.y, p.r + 10 + Math.sin(p.life * 0.12) * 5, 0, 7);
      x.stroke();
      x.beginPath();
      x.moveTo(p.x - p.r, p.y);
      x.lineTo(p.x + p.r, p.y);
      x.moveTo(p.x, p.y - p.r);
      x.lineTo(p.x, p.y + p.r);
      x.stroke();
    } else p.hostile
      ? x.rect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
      : x.arc(p.x, p.y, p.r, 0, 7);
    x.fill();
  }
  for (const e of s.enemies) {
    if (e.kind === "lancer" && e.telegraph) {
      x.strokeStyle = "#ffd77a";
      x.setLineDash([8, 7]);
      x.beginPath();
      x.moveTo(e.x, e.y);
      x.lineTo(s.player.x, s.player.y);
      x.stroke();
      x.setLineDash([]);
    }
    x.save();
    x.translate(e.x, e.y);
    x.rotate(e.age * 0.015);
    x.strokeStyle = e.elite
      ? "#ffe789"
      : e.kind === "warden"
        ? "#ff9ed7"
        : "#ff809b";
    x.fillStyle = e.kind === "warden" ? "#481d55" : "#361c3a";
    x.lineWidth = e.elite ? 4 : 2;
    x.beginPath();
    const sides = e.kind === "warden" ? 8 : e.kind === "splitter" ? 4 : e.kind === "cantor" ? 6 : e.kind === "minekeeper" ? 5 : e.kind === "spark" ? 4 : e.kind === "orbiter" ? 7 : 3;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      x.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
    }
    x.closePath();
    x.fill();
    x.stroke();
    if (e.kind === "cantor") {
      x.beginPath(); x.arc(0, 0, e.r * .48, 0, 7); x.stroke();
    } else if (e.kind === "orbiter") {
      x.beginPath(); x.arc(0, 0, e.r * 1.4, -.8, .8); x.stroke();
    } else if (e.kind === "minekeeper") {
      x.beginPath(); x.moveTo(-e.r,0); x.lineTo(e.r,0); x.moveTo(0,-e.r); x.lineTo(0,e.r); x.stroke();
    } else if (e.kind === "warden") {
      x.strokeStyle = ["#ff9ed7", "#ffd172", "#ff668f"][e.phase - 1] || "#ff9ed7";
      x.lineWidth = 3 + e.phase;
      x.beginPath(); x.arc(0, 0, e.r + 10 + e.phase * 3, 0, 7); x.stroke();
      for(let i=0;i<e.phase;i++){x.beginPath();x.arc(0,0,10+i*9,0,7);x.stroke()}
    }
    x.restore();
  }
  x.save();
  x.translate(s.player.x, s.player.y);
  x.rotate(Math.atan2(s.player.vy, s.player.vx) + Math.PI / 2);
  x.shadowBlur = 14;
  x.shadowColor = "#7ff6ff";
  x.fillStyle = s.player.inv % 8 < 4 ? "#d9ffff" : "#ff879c";
  x.beginPath();
  x.moveTo(0, -16);
  x.lineTo(12, 12);
  x.lineTo(0, 7);
  x.lineTo(-12, 12);
  x.closePath();
  x.fill();
  x.restore();
  if (s.stick) {
    x.strokeStyle = "#b9f8ff88";
    x.lineWidth = 3;
    x.beginPath();
    x.arc(s.stick.x, s.stick.y, 38, 0, 7);
    x.stroke();
  }
}

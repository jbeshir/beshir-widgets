import type { Enemy, EnemyKind, GameState } from "./types";
import { ENEMIES, UPGRADES } from "./catalog";
import { rand } from "./random";
export const W = 900,
  H = 600;
export function fresh(
  seed = 0x5eed,
  muted = false,
  reducedMotion = false,
): GameState {
  return {
    lifecycle: "title",
    frame: 0,
    seed,
    rng: seed,
    score: 0,
    wave: 1,
    waveFrame: 0,
    level: 1,
    xp: 0,
    nextXp: 19,
    player: {
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0,
      hull: 100,
      maxHull: 100,
      inv: 0,
    },
    enemies: [],
    shots: [],
    shards: [],
    cryoFields: [],
    upgrades: { needle: 1 },
    offers: [],
    nextId: 1,
    fire: 0,
    muted,
    reducedMotion,
    cause: "",
    bossHp: null,
    status: "Ready to enter the Reliquary.",
    stick: null,
    aegis: 0,
    aegisCooldown: 0,
    shardsCollected: 0,
    weaponStats: { needle: 0, orbit: 0, mortar: 0, prism: 0, cryo: 0 },
    bossPhase: 0,
  };
}
export function spawn(
  s: GameState,
  kind: EnemyKind,
  x?: number,
  y?: number,
  elite = false,
) {
  if (s.enemies.length >= 90) return;
  const d = ENEMIES[kind],
    scale = elite ? 1.7 : 1,
    a = rand(s) * Math.PI * 2,
    e: Enemy = {
      id: s.nextId++,
      kind,
      hp: d.hp * scale,
      maxHp: d.hp * scale,
      r: d.r * (elite ? 1.3 : 1),
      age: 0,
      cool: 90,
      elite,
      phase: 0,
      x: x ?? W / 2 + Math.cos(a) * 410,
      y: y ?? H / 2 + Math.sin(a) * 260,
    };
  s.enemies.push(e);
  if (kind === "warden") {
    s.bossHp = e.hp;
    s.bossPhase = 1;
  }
  return e;
}
export function begin(s: GameState) {
  if (["title", "won", "lost"].includes(s.lifecycle)) {
    s.lifecycle = "playing";
    s.status = "Wave 1: Drift";
  }
}
export function damagePlayer(s: GameState, n: number) {
  if (s.lifecycle !== "playing" || s.player.inv > 0) return;
  if (s.upgrades.aegis && s.aegis > 0) {
    s.aegis = 0;
    s.aegisCooldown = Math.max(180, 480 - 80 * s.upgrades.aegis);
    s.player.inv = 40;
    s.status = "Aegis shattered — impact repelled.";
    if (s.upgrades.aegis > 1) {
      const force = 18 + s.upgrades.aegis * 7;
      for (const e of s.enemies) {
        const dx = e.x - s.player.x, dy = e.y - s.player.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 145) { e.x += dx / d * force; e.y += dy / d * force; e.slow = Math.max(e.slow || 0, 30); }
      }
      s.weaponStats.aegisRepels = (s.weaponStats.aegisRepels || 0) + 1;
    }
    return;
  }
  s.player.hull = Math.max(0, s.player.hull - n);
  s.player.inv = 55;
  s.status = s.player.hull <= 25 ? "Critical hull!" : "Hull struck.";
  if (!s.player.hull) {
    s.lifecycle = "lost";
    s.cause = "The constellation broke your ward.";
    s.status = "Defeat. The Reliquary waits.";
  }
}
export function grantXp(s: GameState, n: number) {
  s.xp += n;
  if (s.xp >= s.nextXp) {
    s.xp -= s.nextXp;
    s.level++;
    s.nextXp = 12 + s.level * 7;
    offer(s);
  }
}
export function offer(s: GameState) {
  const eligible = UPGRADES.filter((u) => (s.upgrades[u.id] || 0) < 3);
  s.offers = [];
  while (s.offers.length < Math.min(3, eligible.length)) {
    const u = eligible[Math.floor(rand(s) * eligible.length)];
    if (!s.offers.includes(u.id)) s.offers.push(u.id);
  }
  s.lifecycle = "choosing";
  s.status = "Level gained. Choose a relic.";
}
export function choose(s: GameState, id: string) {
  if (s.lifecycle !== "choosing" || !s.offers.includes(id)) return;
  applyUpgrade(s, id);
  s.offers = [];
  s.lifecycle = "playing";
  s.status = `${id} joined the constellation.`;
}
export function grantUpgrade(s: GameState, id: string) {
  if (!UPGRADES.some((u) => u.id === id)) throw Error("unknown upgrade");
  applyUpgrade(s, id);
}
function applyUpgrade(s: GameState, id: string) {
  s.upgrades[id] = (s.upgrades[id] || 0) + 1;
  if (id === "aegis") s.aegis = 1;
  if (id === "overclock") {
    s.player.maxHull = Math.max(40, s.player.maxHull - 15);
    s.player.hull = Math.min(s.player.hull, s.player.maxHull);
  }
}
function nearest(s: GameState) {
  return [...s.enemies].sort(
    (a, b) =>
      Math.hypot(a.x - s.player.x, a.y - s.player.y) -
        Math.hypot(b.x - s.player.x, b.y - s.player.y) || a.id - b.id,
  )[0];
}
function shot(
  s: GameState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  damage: number,
  r = 4,
  kind: "needle" | "mortar" | "mine" = "needle",
  hostile = false,
) {
  if (s.shots.length < 440)
    s.shots.push({
      id: s.nextId++,
      x,
      y,
      vx,
      vy,
      r,
      life: kind === "mortar" ? 48 : 240,
      damage,
      hostile,
      pierce: s.upgrades.pierce || 0,
      kind,
    });
}
function fireNeedles(s: GameState) {
  const t = nearest(s);
  if (!t) return;
  const a = Math.atan2(t.y - s.player.y, t.x - s.player.x),
    count = 1 + (s.upgrades.twin || 0);
  for (let i = 0; i < count; i++) {
    const d = (i - (count - 1) / 2) * 0.12;
    shot(
      s,
      s.player.x,
      s.player.y,
      Math.cos(a + d) * 7,
      Math.sin(a + d) * 7,
      10 * (1 + 0.3 * (s.upgrades.overclock || 0)),
    );
    s.weaponStats.needle++;
  }
}
function weapons(s: GameState) {
  const t = nearest(s);
  if (s.upgrades.aegis && !s.aegis && s.aegisCooldown > 0 && !--s.aegisCooldown)
    s.aegis = 1;
  if (s.upgrades.cryo && Math.hypot(s.player.vx, s.player.vy) > 0.5 && s.frame % 12 === 0) {
    const rank = s.upgrades.cryo;
    s.cryoFields.push({id:s.nextId++,x:s.player.x,y:s.player.y,r:30+rank*10,life:70+rank*25,maxLife:70+rank*25});
    s.weaponStats.cryoFields = (s.weaponStats.cryoFields || 0) + 1;
  }
  if (!t) return;
  if (s.upgrades.orbit) {
    const blades = s.upgrades.orbit;
    for (let i = 0; i < blades; i++) {
      const a = s.frame * 0.07 + (i * Math.PI * 2) / blades,
        bx = s.player.x + Math.cos(a) * 70,
        by = s.player.y + Math.sin(a) * 70;
      for (const e of s.enemies)
        if (Math.hypot(e.x - bx, e.y - by) < e.r + 10 && e.age % 18 === 0) {
          damageEnemy(s, e, 6 + s.upgrades.orbit * 2);
          e.slow = s.upgrades.magnet ? 45 : e.slow;
          s.weaponStats.orbit++;
        }
    }
  }
  if (s.upgrades.mortar && s.frame % (110 - 18 * s.upgrades.mortar) === 0) {
    const a = Math.atan2(t.y - s.player.y, t.x - s.player.x);
    shot(
      s,
      s.player.x,
      s.player.y,
      Math.cos(a) * 5,
      Math.sin(a) * 5,
      20 + 8 * s.upgrades.mortar,
      9,
      "mortar",
    );
    s.weaponStats.mortar++;
  }
  if (s.upgrades.prism && s.frame % 75 < 7 + 4 * s.upgrades.prism) {
    const a = s.frame * (0.028 + s.upgrades.prism * .004);
    for (const e of s.enemies) {
      const dx = e.x - s.player.x,
        dy = e.y - s.player.y,
        d = Math.hypot(dx, dy),
        cross = Math.abs(dx * Math.sin(a) - dy * Math.cos(a));
      if (
        d < 280 &&
        cross < e.r + (5 + s.upgrades.prism * 2) / 2 &&
        dx * Math.cos(a) + dy * Math.sin(a) > 0
      ) {
        damageEnemy(s, e, 0.55 + 0.35 * s.upgrades.prism + (s.upgrades.pierce ? .35 : 0));
        s.weaponStats.prism++;
      }
    }
  }
}
function damageEnemy(s:GameState,e:Enemy,n:number){e.hp-=n;if(e.kind==='warden')s.bossHp=Math.max(0,e.hp)}
function hostile(s: GameState, e: Enemy, count = 3, speed = 2.2) {
  const a = Math.atan2(s.player.y - e.y, s.player.x - e.x);
  for (let i = 0; i < count; i++) {
    const d = (i - (count - 1) / 2) * 0.16;
    shot(
      s,
      e.x,
      e.y,
      Math.cos(a + d) * speed,
      Math.sin(a + d) * speed,
      e.kind === "warden" ? 12 : 9,
      e.kind === "warden" ? 6 : 5,
      "needle",
      true,
    );
  }
}
function behavior(s: GameState, e: Enemy) {
  e.age++;
  if (e.slow) e.slow--;
  const dx = s.player.x - e.x,
    dy = s.player.y - e.y,
    d = Math.hypot(dx, dy) || 1,
    base = ENEMIES[e.kind].speed * (e.slow ? 0.45 : 1);
  let vx = (dx / d) * base,
    vy = (dy / d) * base;
  if (e.kind === "orbiter") {
    vx += (-dy / d) * 0.8;
    vy += (dx / d) * 0.8;
  }
  if (e.kind === "cantor") {
    const dir = d < 210 ? -1 : d > 290 ? 1 : 0;
    vx = (dx / d) * base * dir;
    vy = (dy / d) * base * dir;
    if (--e.cool <= 0) {
      hostile(s, e);
      s.weaponStats.cantorShots = (s.weaponStats.cantorShots || 0) + 1;
      e.cool = 140;
    }
  }
  if (e.kind === "lancer") {
    const cycle = e.age % 150;
    if (cycle < 45) {
      vx = vy = 0;
      e.telegraph = 45 - cycle;
      s.weaponStats.lancerTelegraph = (s.weaponStats.lancerTelegraph || 0) + 1;
    } else if (cycle < 65) {
      vx = (dx / d) * 4.5;
      vy = (dy / d) * 4.5;
      e.phase = 1;
    } else e.phase = 0;
  }
  if (e.kind === "minekeeper") {
    if (--e.cool <= 0) {
      shot(s, e.x, e.y, 0, 0, 14, 13, "mine", true);
      s.weaponStats.minesDropped = (s.weaponStats.minesDropped || 0) + 1;
      e.cool = 180;
    }
    vx *= 0.5;
    vy *= 0.5;
  }
  if (e.kind === "warden") {
    const ratio = e.hp / e.maxHp,
      newPhase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
    if (newPhase !== e.phase) {
      e.phase = newPhase;
      s.bossPhase = newPhase;
      s.weaponStats.bossTransitions = (s.weaponStats.bossTransitions || 0) + 1;
      s.shots = s.shots.filter(
        (p) =>
          !p.hostile || Math.hypot(p.x - s.player.x, p.y - s.player.y) > 100,
      );
      s.status = `Warden phase ${newPhase}: the mask transforms.`;
    }
    vx *= 0.25;
    vy *= 0.25;
    if (--e.cool <= 0) {
      if (e.phase === 1) hostile(s, e, 7, 2);
      else if (e.phase === 2) {
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6 + s.frame * 0.02;
          shot(
            s,
            e.x,
            e.y,
            Math.cos(a) * 2,
            Math.sin(a) * 2,
            10,
            6,
            "needle",
            true,
          );
        }
      } else {
        hostile(s, e, 9, 2.8);
        spawn(s, "drifter", e.x - 70, e.y + 40);
        spawn(s, "drifter", e.x + 70, e.y + 40);
      }
      e.cool = 90 - e.phase * 12;
    }
  }
  e.x += vx;
  e.y += vy;
  if (d < e.r + 13) damagePlayer(s, e.kind === "warden" ? 18 : 12);
}
function kill(s: GameState, e: Enemy) {
  s.score += e.kind === "warden" ? 3000 : e.elite ? 250 : 60;
  if (e.kind === "warden") {
    s.enemies = [];
    s.shots = s.shots.filter((p) => !p.hostile);
    s.lifecycle = "won";
    s.status = "Victory! The Reliquary blooms.";
    s.bossHp = 0;
    return;
  }
  if (e.kind === "splitter") {
    spawn(s, "spark", e.x - 8, e.y);
    spawn(s, "spark", e.x + 8, e.y);
  }
  if ((s.upgrades.cryo || 0) >= 2 && e.slow) {
    const rank=s.upgrades.cryo;
    s.cryoFields.push({id:s.nextId++,x:e.x,y:e.y,r:35+rank*12,life:55+rank*15,maxLife:55+rank*15});
    s.weaponStats.cryoBursts=(s.weaponStats.cryoBursts||0)+1;
  }
  s.shards.push({
    id: s.nextId++,
    x: e.x,
    y: e.y,
    value: ENEMIES[e.kind].value + (e.elite ? 5 : 0),
  });
}
export function tick(s: GameState, input: { x: number; y: number }) {
  if (s.lifecycle !== "playing") return;
  s.frame++;
  s.waveFrame++;
  if (s.player.inv > 0) s.player.inv--;
  const m = Math.hypot(input.x, input.y) || 1;
  s.player.vx += (input.x / m) * 0.7;
  s.player.vy += (input.y / m) * 0.7;
  s.player.vx *= 0.82;
  s.player.vy *= 0.82;
  s.player.x = Math.max(22, Math.min(W - 22, s.player.x + s.player.vx));
  s.player.y = Math.max(22, Math.min(H - 22, s.player.y + s.player.vy));
  if (s.wave < 5 && s.waveFrame >= 2700) {
    s.wave++;
    s.waveFrame = 0;
    s.status = `Wave ${s.wave}`;
    if (s.wave === 5) spawn(s, "warden", W / 2, 100);
  }
  if (s.wave < 5 && s.waveFrame % Math.max(32, 95 - s.wave * 12) === 0) {
    const pools: EnemyKind[][] = [
      [],
      ["drifter"],
      ["drifter", "lancer", "orbiter", "splitter"],
      ["cantor", "orbiter", "splitter", "minekeeper"],
      ["lancer", "cantor", "minekeeper"],
    ];
    spawn(
      s,
      pools[s.wave][Math.floor(rand(s) * pools[s.wave].length)],
      undefined,
      undefined,
      s.wave > 2 && s.waveFrame % 600 === 0,
    );
  }
  const cadence = Math.max(
    10,
    25 - 4 * (s.upgrades.quick || 0) - 3 * (s.upgrades.overclock || 0),
  );
  if (--s.fire <= 0) {
    fireNeedles(s);
    s.fire = cadence;
  }
  weapons(s);
  for(const f of s.cryoFields){
    f.life--;
    for(const e of s.enemies) if(Math.hypot(e.x-f.x,e.y-f.y)<f.r+e.r){e.slow=Math.max(e.slow||0,20+s.upgrades.cryo*15);s.weaponStats.cryo++;}
  }
  s.cryoFields=s.cryoFields.filter(f=>f.life>0);
  for (const e of [...s.enemies]) behavior(s, e);
  for (const p of s.shots) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.kind === "mine" && p.life < 150) p.r += 0.02;
    if (p.kind === "mortar" && p.life <= 0) {
      const blast=65+20*(s.upgrades.mortar||1);
      for (const e of s.enemies)
        if (Math.hypot(e.x - p.x, e.y - p.y) < blast) {
          damageEnemy(s,e,p.damage);
          if (s.upgrades.cryo) e.slow = 100;
        }
      s.weaponStats.mortarBlasts=(s.weaponStats.mortarBlasts||0)+1;
    } else if (p.hostile) {
      if (Math.hypot(p.x - s.player.x, p.y - s.player.y) < p.r + 11) {
        damagePlayer(s, p.damage);
        p.life = 0;
      }
    } else
      for (const e of s.enemies)
        if (p.life > 0 && Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) {
          damageEnemy(s,e,p.damage);
          if (--p.pierce < 0) p.life = 0;
          if (e.kind === "warden") s.bossHp = Math.max(0, e.hp);
        }
  }
  const dead = s.enemies.filter((e) => e.hp <= 0);
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  dead.forEach((e) => kill(s, e));
  s.shots = s.shots.filter(
    (p) => p.life > 0 && p.x > -30 && p.x < W + 30 && p.y > -30 && p.y < H + 30,
  );
  for (const q of s.shards) {
    const d = Math.hypot(q.x - s.player.x, q.y - s.player.y);
    const magnetRadius=90+100*(s.upgrades.magnet||0);
    if (d < magnetRadius) {
      q.x += (s.player.x - q.x) * 0.09;
      q.y += (s.player.y - q.y) * 0.09;
    }
    if (d < 18) {
      if (q.value) {
        grantXp(s, q.value);
        s.score += 5;
        s.shardsCollected++;
        if(s.upgrades.magnet>=2){const every=s.upgrades.magnet>=3?12:20;if(s.shardsCollected%every===0){const heal=s.upgrades.magnet>=3?5:3;s.player.hull=Math.min(s.player.maxHull,s.player.hull+heal);s.weaponStats.magnetHeals=(s.weaponStats.magnetHeals||0)+1;s.status=`Magnet Core restored ${heal} hull.`;}}
      }
      q.value = 0;
    }
  }
  s.shards = s.shards.filter((q) => q.value > 0);
}
export function damageBoss(s: GameState, n: number) {
  const b = s.enemies.find((e) => e.kind === "warden");
  if (!b) throw Error("boss absent");
  b.hp -= n;
  s.bossHp = Math.max(0, b.hp);
  if (b.hp <= 0) {
    s.enemies = s.enemies.filter((e) => e !== b);
    kill(s, b);
  }
}

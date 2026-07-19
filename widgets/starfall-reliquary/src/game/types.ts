export type Life = "title" | "playing" | "paused" | "choosing" | "won" | "lost";
export type EnemyKind =
  | "drifter"
  | "lancer"
  | "cantor"
  | "orbiter"
  | "splitter"
  | "minekeeper"
  | "spark"
  | "warden";
export interface Vec {
  x: number;
  y: number;
}
export interface Enemy extends Vec {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  r: number;
  age: number;
  cool: number;
  elite: boolean;
  phase: number;
  slow?: number;
  telegraph?: number;
}
export interface Shot extends Vec {
  id: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  damage: number;
  hostile: boolean;
  pierce: number;
  kind?: "needle" | "mortar" | "mine";
}
export interface Shard extends Vec {
  id: number;
  value: number;
}
export interface GameState {
  lifecycle: Life;
  frame: number;
  seed: number;
  rng: number;
  score: number;
  wave: number;
  waveFrame: number;
  level: number;
  xp: number;
  nextXp: number;
  player: Vec & {
    vx: number;
    vy: number;
    hull: number;
    maxHull: number;
    inv: number;
  };
  enemies: Enemy[];
  shots: Shot[];
  shards: Shard[];
  upgrades: Record<string, number>;
  offers: string[];
  nextId: number;
  fire: number;
  muted: boolean;
  reducedMotion: boolean;
  cause: string;
  bossHp: number | null;
  status: string;
  stick: Vec | null;
  aegis: number;
  aegisCooldown: number;
  weaponStats: Record<string, number>;
  bossPhase: number;
}

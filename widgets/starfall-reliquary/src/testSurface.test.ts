import type { GameState } from "./game/types";
declare global {
  interface Window {
    __game?: Record<string, any>;
  }
}
export function installTestSurface(
  get: () => GameState,
  actions: Record<string, Function>,
) {
  document.documentElement.dataset.gameState = get().lifecycle;
  const r = document.createElement("span");
  r.id = "game-ready";
  r.textContent = "ready";
  r.style.cssText =
    "position:fixed;width:1px;height:1px;overflow:hidden;opacity:.01";
  document.body.append(r);
  window.__game = {
    ...actions,
    getState: () => {
      const s = get();
      return {
        lifecycle: s.lifecycle,
        frame: s.frame,
        seed: s.seed,
        score: s.score,
        wave: s.wave,
        level: s.level,
        hull: s.player.hull,
        maxHull: s.player.maxHull,
        xp: s.xp,
        enemyCount: s.enemies.length,
        hostileProjectileCount: s.shots.filter((p) => p.hostile).length,
        upgradeIds: Object.keys(s.upgrades).filter((k) => s.upgrades[k]),
        bossHp: s.bossHp,
        muted: s.muted,
        reducedMotion: s.reducedMotion,
        playerX: Math.round(s.player.x),
        playerY: Math.round(s.player.y),
        weaponStats: { ...s.weaponStats },
        bossPhase: s.bossPhase,
        aegis: s.aegis,
        enemyKinds: s.enemies.map((e) => e.kind),
        enemyDetails: s.enemies.map((e) => ({kind:e.kind,phase:e.phase,telegraph:e.telegraph||0,cool:e.cool})),
        playerVelocity: Math.round(Math.hypot(s.player.vx,s.player.vy)*100)/100,
        stickActive: !!s.stick,
        mineCount: s.shots.filter((p) => p.kind === "mine").length,
      };
    },
    getScore: () => get().score,
    getChecksum: () => {
      const s = get();
      return `${s.lifecycle}:${s.frame}:${s.score}:${Math.round(s.player.x)},${Math.round(s.player.y)}:${s.enemies.map((e) => `${e.id}-${Math.round(e.hp)}`).join(".")}:${Object.keys(s.upgrades).sort().join(".")}`;
    },
  };
}
export function updateTestState(state: string) {
  document.documentElement.dataset.gameState = state;
}

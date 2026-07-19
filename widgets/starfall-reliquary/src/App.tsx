import { useEffect, useRef, useState } from "preact/hooks";
import { AudioEngine } from "./game/audio";
import { UPGRADES, upgradeName } from "./game/catalog";
import {
  begin,
  choose,
  damageBoss,
  damagePlayer,
  fresh,
  grantUpgrade,
  grantXp,
  spawn,
  tick,
  W,
  H,
} from "./game/simulation";
import { draw } from "./game/render";
import type { EnemyKind, GameState } from "./game/types";
import { installTestSurface, updateTestState } from "./testSurface";
type Pref = { mute: boolean; reduced: boolean; best: number; runs: number };
const key = "starfall-reliquary:v1";
function prefs(): Pref {
  try {
    const x = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      mute: !!x.mute,
      reduced: !!x.reduced,
      best: Number.isFinite(x.best) ? x.best : 0,
      runs: Number.isFinite(x.runs) ? x.runs : 0,
    };
  } catch {
    return { mute: false, reduced: false, best: 0, runs: 0 };
  }
}
export function App() {
  const pref = useRef(prefs()),
    game = useRef<GameState>(
      fresh(0x5eed, pref.current.mute, pref.current.reduced),
    ),
    audio = useRef(new AudioEngine(pref.current.mute)),
    canvas = useRef<HTMLCanvasElement>(null),
    held = useRef(new Set<string>()),
    pointer = useRef<{ id: number; ax: number; ay: number } | null>(null),
    touches = useRef(new Map<number, { ax: number; ay: number }>()),
    [rev, setRev] = useState(0);
  const focused = useRef(0);
  const lastSignal = useRef("");
  const rerender = () => setRev((v) => v + 1);
  void rev;
  const save = () => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          mute: game.current.muted,
          reduced: game.current.reducedMotion,
          best: Math.max(pref.current.best, game.current.score),
          runs: pref.current.runs,
        }),
      );
    } catch {}
  };
  const start = () => {
    audio.current.gesture();
    begin(game.current);
    rerender();
  };
  const restart = () => {
    const g = game.current;
    game.current = fresh(g.seed, g.muted, g.reducedMotion);
    begin(game.current);
    audio.current.tone(330);
    rerender();
  };
  const pause = () => {
    const g = game.current;
    if (g.lifecycle === "playing") {
      g.lifecycle = "paused";
      g.status = "Paused.";
    } else if (g.lifecycle === "paused") {
      g.lifecycle = "playing";
      g.status = "Resumed.";
    }
    rerender();
  };
  const mute = () => {
    const g = game.current;
    g.muted = !g.muted;
    audio.current.setMute(g.muted);
    g.status = g.muted ? "Sound muted." : "Sound on.";
    save();
    rerender();
  };
  useEffect(() => {
    document.documentElement.dataset.widgetState = "ready";
    let ready = document.getElementById("widget-ready");
    if (!ready) {
      ready = document.createElement("span");
      ready.id = "widget-ready";
      ready.hidden = true;
      document.body.append(ready);
    }
    installTestSurface(() => game.current, {
      start,
      restart,
      setSeed: (n: number) => {
        if (
          !Number.isFinite(n) ||
          !["title", "won", "lost"].includes(game.current.lifecycle)
        )
          throw Error("invalid seed state");
        game.current = fresh(
          n >>> 0,
          game.current.muted,
          game.current.reducedMotion,
        );
        rerender();
      },
      grantXp: (n: number) => {
        if (!Number.isFinite(n)) throw Error("invalid xp");
        grantXp(game.current, n);
        rerender();
      },
      grantUpgrade: (id: string) => {
        grantUpgrade(game.current, id);
        rerender();
      },
      setHull: (n: number) => {
        if (!Number.isFinite(n)) throw Error("invalid hull");
        game.current.player.hull = Math.max(
          0,
          Math.min(game.current.player.maxHull, n),
        );
        rerender();
      },
      spawnEnemy: (k: EnemyKind, x?: number, y?: number) => {
        if (
          !Object.keys({
            drifter: 1,
            lancer: 1,
            cantor: 1,
            orbiter: 1,
            splitter: 1,
            minekeeper: 1,
            spark: 1,
            warden: 1,
          }).includes(k)
        )
          throw Error("unknown archetype");
        spawn(game.current, k, x, y);
        rerender();
      },
      setWave: (n: number) => {
        if (!Number.isFinite(n) || n < 1 || n > 5) throw Error("invalid wave");
        game.current.wave = n;
        game.current.waveFrame = 0;
        if (n === 5 && !game.current.enemies.some((e) => e.kind === "warden"))
          spawn(game.current, "warden", W / 2, 100);
        rerender();
      },
      damagePlayer: (n: number) => {
        damagePlayer(game.current, n);
        rerender();
      },
      damageBoss: (n: number) => {
        damageBoss(game.current, n);
        rerender();
      },
    });
  }, []);
  useEffect(() => {
    let last = performance.now(),
      acc = 0,
      id = 0,
      renderPulse = 0;
    const loop = (now: number) => {
      acc += Math.min(100, now - last);
      last = now;
      let n = 0;
      while (acc >= 1000 / 60 && n++ < 5) {
        const g = game.current,
          stick = g.stick;
        const ix =
            (held.current.has("KeyD") || held.current.has("ArrowRight")
              ? 1
              : 0) -
            (held.current.has("KeyA") || held.current.has("ArrowLeft")
              ? 1
              : 0) +
            (stick?.x || 0),
          iy =
            (held.current.has("KeyS") || held.current.has("ArrowDown")
              ? 1
              : 0) -
            (held.current.has("KeyW") || held.current.has("ArrowUp") ? 1 : 0) +
            (stick?.y || 0);
        tick(g, { x: ix, y: iy });
        acc -= 1000 / 60;
      }
      if (canvas.current) draw(canvas.current, game.current);
      if (game.current.status !== lastSignal.current) {
        const message = game.current.status;
        lastSignal.current = message;
        if (/struck|Critical|Defeat/.test(message)) audio.current.tone(120, 0.12);
        else if (/Wave|phase/.test(message)) audio.current.tone(280, 0.1);
        else if (/Victory/.test(message)) audio.current.tone(720, 0.2);
      }
      updateTestState(game.current.lifecycle);
      if (++renderPulse % 6 === 0) rerender();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      ) {
        held.current.add(e.code);
        if (
          game.current.lifecycle === "choosing" &&
          (e.code === "KeyA" ||
            e.code === "ArrowLeft" ||
            e.code === "KeyD" ||
            e.code === "ArrowRight")
        ) {
          focused.current =
            (focused.current +
              (e.code === "KeyA" || e.code === "ArrowLeft" ? 2 : 1)) %
            3;
          requestAnimationFrame(() =>
            document.querySelectorAll<HTMLButtonElement>(".card")[focused.current]?.focus(),
          );
        }
        e.preventDefault();
      }
      if (e.code === "Escape") pause();
      if (e.code === "KeyM") mute();
      if (e.code === "Enter") {
        const g = game.current;
        if (g.lifecycle === "title") start();
        else if (g.lifecycle === "choosing")
          choose(g, g.offers[focused.current]);
        else if (g.lifecycle === "won" || g.lifecycle === "lost") restart();
        rerender();
      }
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.code);
    const blur = () => {
      held.current.clear();
      game.current.stick = null;
      if (game.current.lifecycle === "playing") {
        game.current.lifecycle = "paused";
        game.current.status = "Paused when focus was lost.";
      }
      rerender();
    };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("blur", blur);
    const visibility = () => {
      if (document.hidden) blur();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
      removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const coords = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
  };
  const pd = (e: PointerEvent) => {
    if (game.current.lifecycle !== "playing") return;
    audio.current.gesture();
    const p = coords(e);
    pointer.current = { id: e.pointerId, ax: p.x, ay: p.y };
    canvas.current!.setPointerCapture?.(e.pointerId);
    game.current.stick = { x: p.x, y: p.y };
  };
  const pm = (e: PointerEvent) => {
    if (pointer.current?.id !== e.pointerId) return;
    const p = coords(e),
      a = pointer.current,
      dx = p.x - a.ax,
      dy = p.y - a.ay,
      m = Math.hypot(dx, dy);
    game.current.stick =
      m < 8
        ? { x: 0, y: 0 }
        : { x: dx / Math.max(45, m), y: dy / Math.max(45, m) };
  };
  const pu = (e: PointerEvent) => {
    if (pointer.current?.id === e.pointerId) {
      pointer.current = null;
      game.current.stick = null;
    }
  };
  const touch = (kind: "start" | "move" | "end" | "cancel", e: TouchEvent) => {
    e.preventDefault();
    if (kind === "start" && game.current.lifecycle !== "playing") return;
    for (const t of Array.from(e.changedTouches)) {
      const p = coords(t);
      if (kind === "start")
        touches.current.set(t.identifier, { ax: p.x, ay: p.y });
      else if (kind === "move") {
        const a = touches.current.get(t.identifier);
        if (a) {
          const dx = p.x - a.ax,
            dy = p.y - a.ay,
            m = Math.hypot(dx, dy);
          game.current.stick = {
            x: dx / Math.max(45, m),
            y: dy / Math.max(45, m),
          };
        }
      } else {
        touches.current.delete(t.identifier);
        if (!touches.current.size) game.current.stick = null;
      }
    }
  };
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const start = (event: TouchEvent) => touch("start", event);
    const move = (event: TouchEvent) => touch("move", event);
    const end = (event: TouchEvent) => touch("end", event);
    const cancel = (event: TouchEvent) => touch("cancel", event);
    element.addEventListener("touchstart", start, { passive: false });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end, { passive: false });
    element.addEventListener("touchcancel", cancel, { passive: false });
    return () => {
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", cancel);
    };
  }, []);
  const g = game.current;
  const pick = (id: string) => {
    choose(g, id);
    audio.current.tone(660);
    rerender();
  };
  return (
    <main class="shell">
      <header>
        <div>
          <p class="eyebrow">ORBITAL GARDEN // RELIQUARY 07</p>
          <h1>
            Starfall <span>Reliquary</span>
          </h1>
        </div>
        <div class="controls">
          <button
            onClick={mute}
            data-testid="mute-button"
            aria-label={g.muted ? "Unmute sound" : "Mute sound"}
          >
            {g.muted ? "Sound off" : "Sound on"}
          </button>
          <button
            onClick={pause}
            data-testid="pause-button"
            disabled={!["playing", "paused"].includes(g.lifecycle)}
          >
            {g.lifecycle === "paused" ? "Resume" : "Pause"}
          </button>
        </div>
      </header>
      <section class="hud" aria-label="Run status">
        <div>
          <small>HULL</small>
          <strong>
            {Math.ceil(g.player.hull)} / {g.player.maxHull}
          </strong>
          <i>
            <b
              style={{ width: `${(g.player.hull / g.player.maxHull) * 100}%` }}
            />
          </i>
        </div>
        <div>
          <small>CONSTELLATION</small>
          <strong>Level {g.level}</strong>
          <i>
            <b style={{ width: `${(g.xp / g.nextXp) * 100}%` }} />
          </i>
        </div>
        <div>
          <small>WAVE</small>
          <strong data-testid="wave-label">Wave {g.wave}</strong>
        </div>
        <div>
          <small>SCORE</small>
          <strong>{g.score.toString().padStart(6, "0")}</strong>
        </div>
      </section>
      <div class="layout">
        <section class="arena">
          <canvas
            ref={canvas}
            aria-label="Starfall Reliquary arena. Drag to steer."
            tabIndex={0}
            onPointerDown={pd as any}
            onPointerMove={pm as any}
            onPointerUp={pu as any}
            onPointerCancel={pu as any}
          />
          <output data-player-position aria-label="Player position">
            {Math.round(g.player.x)},{Math.round(g.player.y)}
          </output>
          {g.lifecycle === "title" && (
            <div class="overlay title">
              <div class="sigil">✦</div>
              <p class="kicker">CULTIVATE A WEAPONIZED CONSTELLATION</p>
              <h2>The garden is waking.</h2>
              <p>
                Steer through enemy patterns. Your relics fire automatically.
                Gather shards, choose upgrades, and outlast the Warden.
              </p>
              <button
                class="primary"
                data-testid="start-button"
                onClick={start}
              >
                Begin run <span>↵</span>
              </button>
              <p class="hint">
                WASD / arrows to move · drag to steer · Esc to pause
              </p>
            </div>
          )}
          {g.lifecycle === "paused" && (
            <div class="overlay">
              <p class="kicker">TIME SUSPENDED</p>
              <h2>Reliquary paused</h2>
              <button
                class="primary"
                data-testid="resume-button"
                onClick={pause}
              >
                Resume
              </button>
              <button onClick={restart}>Restart run</button>
            </div>
          )}
          {g.lifecycle === "choosing" && (
            <div
              class="overlay choice"
              role="dialog"
              aria-modal="true"
              aria-labelledby="choice-title"
              data-testid="upgrade-dialog"
            >
              <p class="kicker">CONSTELLATION EXPANDS</p>
              <h2 id="choice-title">Choose a relic</h2>
              <div class="cards">
                {g.offers.map((id, i) => {
                  const u = UPGRADES.find((x) => x.id === id)!;
                  const synergy =
                    (id === "orbit" && g.upgrades.magnet) ||
                    (id === "prism" && g.upgrades.pierce) ||
                    (id === "mortar" && g.upgrades.cryo);
                  return (
                    <button
                      class="card"
                      autoFocus={i === 0}
                      onClick={() => pick(id)}
                      data-testid={`upgrade-${id}`}
                    >
                      <small>
                        {u.tag} · Rank {(g.upgrades[id] || 0) + 1}
                      </small>
                      <b>{u.name}</b>
                      <span>{u.text}</span>
                      {synergy && <em>SYNERGY READY</em>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {(g.lifecycle === "won" || g.lifecycle === "lost") && (
            <div class={`overlay ${g.lifecycle}`}>
              <p class="kicker">
                {g.lifecycle === "won"
                  ? "RELIQUARY RESTORED"
                  : "CONSTELLATION FALLEN"}
              </p>
              <h2>
                {g.lifecycle === "won"
                  ? "The garden blooms again."
                  : "Your light returns to the dark."}
              </h2>
              <p>{g.cause || "The Warden has been unmade."}</p>
              <strong class="final-score">
                {g.score.toString().padStart(6, "0")} points · Level {g.level}
              </strong>
              <button
                class="primary"
                data-testid="restart-button"
                onClick={restart}
              >
                Begin anew
              </button>
            </div>
          )}
        </section>
        <aside>
          <h2>Constellation</h2>
          <p class="build-name">
            {Object.keys(g.upgrades)
              .filter((k) => g.upgrades[k])
              .map(upgradeName)
              .join(" · ")}
          </p>
          <div class="relics">
            {Object.entries(g.upgrades)
              .filter(([, v]) => v)
              .map(([id, v]) => (
                <div>
                  <span>✧</span>
                  <p>
                    <b>{upgradeName(id)}</b>
                    <small>Rank {v}</small>
                  </p>
                </div>
              ))}
          </div>
          <div class="legend">
            <h3>Threat glyphs</h3>
            <p>
              <i class="diamond" />
              Chasers &amp; divers
            </p>
            <p>
              <i class="square" />
              Hostile volleys
            </p>
            <p>
              <i class="ring" />
              Telegraphed danger
            </p>
          </div>
        </aside>
      </div>
      <footer>
        <span role="status" aria-live="polite">
          {g.status}
        </span>
        <label>
          <input
            type="checkbox"
            checked={g.reducedMotion}
            onChange={(e) => {
              g.reducedMotion = (e.currentTarget as HTMLInputElement).checked;
              save();
              rerender();
            }}
          />{" "}
          Reduced effects
        </label>
      </footer>
    </main>
  );
}

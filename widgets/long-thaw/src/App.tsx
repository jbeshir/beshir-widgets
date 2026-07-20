import { useEffect, useRef } from 'preact/hooks';
import { mountGame } from './game';

export function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => canvas.current ? mountGame(canvas.current) : undefined, []);
  return <main class="shell">
    <canvas ref={canvas} width="1280" height="720" tabIndex={0} aria-label="The Long Thaw game canvas" />
    <p class="fallback">Click the game to focus. Move with A/D or arrows, jump with Space, dash with Shift, and place the ember with E.</p>
  </main>;
}

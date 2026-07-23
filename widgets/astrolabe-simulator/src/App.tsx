import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Front } from './components/Front';
import { Back } from './components/Back';
import { Controls } from './components/Controls';
import { InfoPanel } from './components/InfoPanel';
import { useStore } from './store';

export function App(): JSX.Element {
  const state = useStore();
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    document.documentElement.dataset.widgetState = ready ? 'ready' : 'loading';
  }, [ready]);

  // Report content height so a host page can auto-size the iframe to fit.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const send = () => window.parent.postMessage({ type: 'resize', height: el.scrollHeight }, '*');
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, []);

  return (
    <div className="container" ref={rootRef}>
      <div className="card">
        <header className="card-header header-row">
          <h1>Astrolabe Simulator</h1>
          <p className="hint">A working map of the heavens, engraved for latitude {state.plateLatitude.toFixed(2)}°.</p>
        </header>
        <Controls />
        <div className="widget-layout">
          <div className={`instrument-stage${state.reducedMotion ? ' reduced-motion' : ''}`}>
            {state.face === 'front' ? <Front /> : <Back />}
          </div>
          <InfoPanel />
        </div>
      </div>
      {ready && <div id="widget-ready" data-ready="true" hidden />}
    </div>
  );
}

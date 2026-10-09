// Anchored, non-modal popover: positioned next to its anchor (below, flipping above when there is
// no room), closes on Escape or a pointer press outside it and the anchor, moves focus into itself
// on open and returns it to the anchor on close. role="dialog" (it can hold buttons/links).
// Tab / Shift+Tab or focus leaving it closes it and hands focus back to the anchor, so keyboard
// users are never stranded at the end of the overlay root.

import type { ComponentChildren, RefObject } from 'preact';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { LayerZ, layerZ, pushLayer, restoreFocus } from './layers';
import { Portal } from './Portal';

interface Props {
  anchor: RefObject<HTMLElement> | HTMLElement | null;
  onClose: () => void;
  /** Accessible name. */
  label: string;
  testid?: string;
  class?: string;
  /** id of the popover element (the anchor can point at it with aria-controls). */
  id?: string;
  /** 'above' prefers the space above the anchor (so a trigger below its subject never covers it). */
  placement?: 'auto' | 'above';
  children: ComponentChildren;
}

const GAP = 8;
const MARGIN = 8;

function anchorEl(a: Props['anchor']): HTMLElement | null {
  if (!a) return null;
  return a instanceof HTMLElement ? a : a.current;
}

export function Popover({ anchor, onClose, label, testid, class: cls, id, placement = 'auto', children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const parentZ = useContext(LayerZ);
  const z = layerZ('var(--z-popover)', parentZ);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Position against the anchor; re-run on resize/scroll so it follows the page.
  useLayoutEffect(() => {
    const place = () => {
      const a = anchorEl(anchor);
      const el = ref.current;
      if (!a || !el) return;
      const r = a.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const fitsAbove = r.top - GAP - h >= MARGIN;
      const fitsBelow = r.bottom + GAP + h <= vh - MARGIN;
      const above = placement === 'above' ? fitsAbove || !fitsBelow && r.top > vh - r.bottom : !fitsBelow && fitsAbove;
      const top = Math.max(MARGIN, above ? r.top - GAP - h : Math.min(r.bottom + GAP, vh - MARGIN - h));
      const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - w / 2), Math.max(MARGIN, vw - w - MARGIN));
      setPos({ top, left, above });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  useEffect(() => {
    const opener = document.activeElement;
    const close = () => closeRef.current();
    const pop = pushLayer({ close, modal: false });
    ref.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchorEl(anchor)?.contains(t)) return;
      close();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      pop();
      document.removeEventListener('pointerdown', onDown, true);
      // Only pull focus back if it is still inside the popover (a click elsewhere keeps its target).
      const active = document.activeElement;
      if (!active || active === document.body || ref.current?.contains(active)) restoreFocus(anchorEl(anchor) ?? opener);
    };
  }, []);

  // Leave via the keyboard: Tab either way closes and returns to the anchor.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    closeRef.current();
  };
  const onFocusOut = (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && !ref.current?.contains(next) && !anchorEl(anchor)?.contains(next)) closeRef.current();
  };

  return (
    <Portal>
      <div
        ref={ref}
        id={id}
        onKeyDown={onKeyDown}
        onFocusOut={onFocusOut}
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        data-testid={testid}
        data-placement={pos?.above ? 'above' : 'below'}
        class={`popover${cls ? ` ${cls}` : ''}`}
        style={{ zIndex: z, top: `${pos?.top ?? -9999}px`, left: `${pos?.left ?? -9999}px` }}
      >
        <LayerZ.Provider value={z}>{children}</LayerZ.Provider>
      </div>
    </Portal>
  );
}

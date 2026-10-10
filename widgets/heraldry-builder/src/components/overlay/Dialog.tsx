// Modal dialog (centred card) that becomes a bottom sheet on narrow viewports. Focus is trapped
// (Tab wraps; the app behind is inert), Escape closes the topmost layer, focus returns to the
// opener on close, and a press on the backdrop closes it. While the body has more content below
// what is shown, the dialog carries data-more-below so the body's bottom edge fades out as a cue.

import type { ComponentChildren, RefObject } from 'preact';
import { useContext, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { LayerZ, focusables, layerZ, pushLayer, restoreFocus } from './layers';
import { Portal } from './Portal';

interface Props {
  title: string;
  onClose: () => void;
  /** 'dialog' (z token --z-dialog) or 'sheet' (--z-sheet, e.g. entry detail). Both are bottom sheets on mobile. */
  layer?: 'dialog' | 'sheet';
  testid?: string;
  class?: string;
  /** Element to focus on open: a ref, or 'title' for the heading (defaults to the first focusable control). */
  initialFocus?: RefObject<HTMLElement> | 'title';
  /** id of an element rendered outside the dialog (e.g. a popover) that belongs to it for assistive tech. */
  owns?: string;
  /** Optional footer (actions). */
  footer?: ComponentChildren;
  children: ComponentChildren;
}

let seq = 0;

export function Dialog({ title, onClose, layer = 'dialog', testid, class: cls, initialFocus, footer, owns, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(`dlg-${++seq}`);
  const parentZ = useContext(LayerZ);
  const z = layerZ(layer === 'sheet' ? 'var(--z-sheet)' : 'var(--z-dialog)', parentZ);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const pop = pushLayer({ close: () => closeRef.current(), modal: true });
    const el = ref.current;
    const requested = initialFocus === 'title' ? titleRef.current : initialFocus?.current;
    const target = requested ?? (el ? focusables(el)[0] : null) ?? el;
    target?.focus({ preventScroll: true });
    return () => {
      pop();
      restoreFocus(opener);
    };
  }, []);

  // Following a link to another page leaves the dialog behind.
  useEffect(() => {
    const leave = () => closeRef.current();
    window.addEventListener('hashchange', leave);
    return () => window.removeEventListener('hashchange', leave);
  }, []);

  // Runs after every render: the body's content (and so its height) changes with what the dialog shows.
  useLayoutEffect(() => {
    const dialog = ref.current;
    const body = bodyRef.current;
    if (!dialog || !body) return;
    const update = () => {
      const below = body.scrollTop + body.clientHeight < body.scrollHeight - 2;
      dialog.setAttribute('data-more-below', below ? 'true' : 'false');
    };
    update();
    body.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(body);
    Array.from(body.children).forEach((c) => ro.observe(c));
    return () => {
      body.removeEventListener('scroll', update);
      ro.disconnect();
    };
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const items = focusables(ref.current);
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const titleId = `${idRef.current}-title`;
  return (
    <Portal>
      <div
        class={`dialog-backdrop dialog-backdrop-${layer}`}
        style={{ zIndex: z }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) closeRef.current();
        }}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-owns={owns}
          tabIndex={-1}
          data-testid={testid}
          class={`dialog dialog-${layer}${cls ? ` ${cls}` : ''}`}
          onKeyDown={onKeyDown}
        >
          <header class="dialog-header">
            <h2 id={titleId} ref={titleRef} tabIndex={-1}>{title}</h2>
            <button type="button" class="icon-button" aria-label="Close" onClick={() => closeRef.current()}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
              </svg>
            </button>
          </header>
          <div class="dialog-body" ref={bodyRef}>
            <LayerZ.Provider value={z}>{children}</LayerZ.Provider>
          </div>
          {footer && <footer class="dialog-footer"><LayerZ.Provider value={z}>{footer}</LayerZ.Provider></footer>}
        </div>
      </div>
    </Portal>
  );
}

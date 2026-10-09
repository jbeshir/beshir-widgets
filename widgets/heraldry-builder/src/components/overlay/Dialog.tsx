// Modal dialog (centred card) that becomes a bottom sheet on narrow viewports. Focus is trapped
// (Tab wraps; the app behind is inert), Escape closes the topmost layer, focus returns to the
// opener on close, and a press on the backdrop closes it.

import type { ComponentChildren, RefObject } from 'preact';
import { useContext, useEffect, useRef } from 'preact/hooks';
import { LayerZ, focusables, layerZ, pushLayer, restoreFocus } from './layers';
import { Portal } from './Portal';

interface Props {
  title: string;
  onClose: () => void;
  /** 'dialog' (z token --z-dialog) or 'sheet' (--z-sheet, e.g. entry detail). Both are bottom sheets on mobile. */
  layer?: 'dialog' | 'sheet';
  testid?: string;
  class?: string;
  /** Element to focus on open (defaults to the first focusable control). */
  initialFocus?: RefObject<HTMLElement>;
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
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const pop = pushLayer({ close: () => closeRef.current(), modal: true });
    const el = ref.current;
    const target = initialFocus?.current ?? (el ? focusables(el)[0] : null) ?? el;
    target?.focus({ preventScroll: true });
    return () => {
      pop();
      restoreFocus(opener);
    };
  }, []);

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
            <h2 id={titleId}>{title}</h2>
            <button type="button" class="icon-button" aria-label="Close" onClick={() => closeRef.current()}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
              </svg>
            </button>
          </header>
          <div class="dialog-body">
            <LayerZ.Provider value={z}>{children}</LayerZ.Provider>
          </div>
          {footer && <footer class="dialog-footer"><LayerZ.Provider value={z}>{footer}</LayerZ.Provider></footer>}
        </div>
      </div>
    </Portal>
  );
}

// Every popover, dialog and sheet renders into the single #overlay-root (a sibling of #app in
// index.html), so overlays never fight the app's stacking contexts or overflow clipping.

import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';

export function overlayRoot(): HTMLElement {
  let el = document.getElementById('overlay-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'overlay-root';
    document.body.appendChild(el);
  }
  return el;
}

export function Portal({ children }: { children: ComponentChildren }) {
  return createPortal(<>{children}</>, overlayRoot());
}

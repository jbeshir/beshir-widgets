// Overlay layer bookkeeping shared by Popover and Dialog.
//
// - One Escape listener for the whole page closes only the topmost layer, so Esc inside a popover
//   that sits in a dialog closes the popover and leaves the dialog open.
// - Each layer provides its z-index (a CSS expression over the tokens in styles.css) to its
//   descendants, so a popover opened inside a dialog stacks above that dialog.
// - While any modal layer is open the in-page app is made inert (focus and clicks stay in the
//   overlay root) and the page stops scrolling behind it.

import { createContext } from 'preact';

interface Layer {
  close: () => void;
  modal: boolean;
}

const stack: Layer[] = [];

function sync(): void {
  const modal = stack.some((l) => l.modal);
  const app = document.getElementById('app');
  if (app) {
    if (modal) app.setAttribute('inert', '');
    else app.removeAttribute('inert');
  }
  document.documentElement.classList.toggle('overlay-open', modal);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  e.stopPropagation();
  stack[stack.length - 1].close();
}

/** Register an open layer; returns the unregister function (call it from the effect cleanup). */
export function pushLayer(layer: Layer): () => void {
  if (!stack.length) document.addEventListener('keydown', onKeyDown, true);
  stack.push(layer);
  sync();
  return () => {
    const i = stack.indexOf(layer);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) document.removeEventListener('keydown', onKeyDown, true);
    sync();
  };
}

/** Is `layer` (identified by its close callback) the topmost open layer? */
export function isTopLayer(close: () => void): boolean {
  return stack.length > 0 && stack[stack.length - 1].close === close;
}

/** z-index of the enclosing overlay layer, or null at page level. */
export const LayerZ = createContext<string | null>(null);

/** z-index for a layer whose own token is `token`, stacked above `parent` when nested. */
export function layerZ(token: string, parent: string | null): string {
  return parent ? `max(${token}, calc(${parent} + 1))` : token;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('inert') && el.getClientRects().length > 0);
}

/** Focus an element if it is still in the document (used to restore focus on close). */
export function restoreFocus(el: Element | null): void {
  if (el instanceof HTMLElement && el.isConnected) el.focus({ preventScroll: true });
}

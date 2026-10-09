// Whether the visitor has dismissed the welcome strip on the Design tab, remembered in localStorage
// so it stays away on this device. Only store.ts imports this module.

const KEY = 'heraldry-builder:welcome-dismissed:v1';

export function readWelcomeDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeWelcomeDismissed(): void {
  try {
    localStorage.setItem(KEY, 'true');
  } catch {
    /* storage may be unavailable (private mode / quota); the strip simply shows again next visit */
  }
}

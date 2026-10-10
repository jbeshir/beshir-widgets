// Whether the Design tab's examples box has been shown on this device, remembered in localStorage so
// it starts folded on later visits. Without storage it counts as seen: the box starts folded rather
// than opening on every visit. Only store.ts imports this module.

const KEY = 'heraldry-builder:examples-seen:v1';

export function readExamplesSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return true;
  }
}

export function writeExamplesSeen(): void {
  try {
    localStorage.setItem(KEY, 'true');
  } catch {
    /* storage may be unavailable (private mode / quota); the box then starts folded anyway */
  }
}

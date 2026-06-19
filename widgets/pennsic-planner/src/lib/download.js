// @ts-check
// Browser-only helper: build an .ics for the given sessions and trigger a download.
// Kept separate from ics.js so that module stays DOM-free and shareable with the Node test.
import { buildIcs } from './ics.js';

/**
 * Build an iCalendar document for the sessions and prompt the browser to download it.
 * @param {import('../types').Session[]} sessions
 * @param {string} [filename]
 */
export function downloadIcs(sessions, filename = 'pennsic-plan-2026.ics') {
  const text = buildIcs(sessions);
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

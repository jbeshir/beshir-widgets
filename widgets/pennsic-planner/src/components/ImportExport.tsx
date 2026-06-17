import { useState, useRef } from 'preact/hooks';
import type { Session } from '../types';
import { planStore } from '../store';
import { normalizeCsv } from '../lib/normalize.js';
import { buildIcs } from '../lib/ics.js';

interface Props {
  planSessions: Session[];
  currentPlanIds: string[];
}

function downloadIcs(sessions: Session[]) {
  const text = buildIcs(sessions) as string;
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pennsic-plan-2026.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function ImportExport({ planSessions, currentPlanIds }: Props) {
  const [csvText, setCsvText] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport(text: string) {
    try {
      const records = normalizeCsv(text, { defaultYear: 2026 }) as Session[];
      if (records.length === 0) {
        setFeedback({ type: 'error', msg: 'No sessions found in the CSV. Check the format.' });
        return;
      }
      await planStore.setDataset(records);

      const newIds = new Set(records.map((r) => r.id));
      const preserved = currentPlanIds.filter((id) => newIds.has(id));
      await planStore.setPlan(preserved);

      setFeedback({
        type: 'success',
        msg: `Imported ${records.length} sessions. ${preserved.length} of your planned sessions were preserved.`,
      });
      setCsvText('');
    } catch (err) {
      setFeedback({ type: 'error', msg: String((err as Error).message ?? err) });
    }
  }

  async function handleReset() {
    await planStore.setDataset(null);
    setFeedback({ type: 'success', msg: 'Reset to bundled Pennsic 53 (2026) data.' });
  }

  function handleFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') handleImport(text);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div class="import-export">
      <div class="ie-section">
        <h2>Import Schedule CSV</h2>
        <p>
          Import an updated schedule from{' '}
          <strong>thing.pennsicuniversity.org</strong>. Go to the Pennsic University
          calendar page, use the <em>Calendars</em> export, and download the CSV. The
          expected columns are: <code>start_time</code>, <code>end_time</code>,{' '}
          <code>class_title</code>, <code>topic</code>, <code>session_location_name</code>,{' '}
          <code>instructor_name</code>, <code>instructor_kingdom</code>,{' '}
          <code>short_description</code>, <code>material_fee</code>, <code>handout_fee</code>,{' '}
          <code>adult_only_reason</code>. Column order and names are flexible.
        </p>
        <div class="file-pick-row">
          <button
            class="file-pick-btn"
            onClick={() => fileRef.current?.click()}
            aria-label="Choose a CSV file to import"
          >
            Choose CSV file…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFile}
            aria-hidden="true"
          />
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>or paste below:</span>
        </div>
        <textarea
          class="csv-textarea"
          placeholder="Paste CSV text here…"
          value={csvText}
          onInput={(e) => setCsvText((e.target as HTMLTextAreaElement).value)}
          aria-label="Paste CSV content here"
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            class="import-btn"
            onClick={() => csvText.trim() && handleImport(csvText)}
            disabled={!csvText.trim()}
            aria-label="Import pasted CSV"
          >
            Import
          </button>
          <button
            class="reset-btn"
            onClick={handleReset}
            aria-label="Reset to bundled Pennsic 53 data"
          >
            Reset to bundled Pennsic 53 (2026) data
          </button>
        </div>
        {feedback && (
          <div class={`import-feedback ${feedback.type}`} role="status">
            {feedback.msg}
          </div>
        )}
      </div>

      <div class="ie-section">
        <h2>Export to Calendar</h2>
        <p>
          Download your planned sessions as a <strong>.ics</strong> file compatible with
          Google Calendar, Apple Calendar, Outlook, and other calendar apps. After
          downloading, import via <em>File → Import</em> (Apple Calendar / Outlook) or
          <em>Settings → Import &amp; Export → Import</em> (Google Calendar).
        </p>
        <button
          class="plan-export-btn"
          onClick={() => downloadIcs(planSessions)}
          disabled={planSessions.length === 0}
          aria-label="Download calendar file"
          style={planSessions.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
        >
          Download pennsic-plan-2026.ics
          {planSessions.length > 0 && ` (${planSessions.length} session${planSessions.length !== 1 ? 's' : ''})`}
        </button>
        {planSessions.length === 0 && (
          <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--muted)' }}>
            Add sessions to your plan first (Timetable tab).
          </p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'preact/hooks';

export type CreateStatus = 'idle' | 'creating' | 'error';

interface Props {
  status: CreateStatus;
  errorMessage?: string;
  onCreate: () => void;
}

// The top bar shown in the LOCKED PREVIEW, before any map exists. It replaces the editable bar's
// rename field + Share popover with a static, non-editable "Untitled map" title and a single primary
// action: "Create shared map". Share would be meaningless here (there is nothing to share yet), and the
// name is deliberately not editable (no pencil affordance) — the whole map is immutable until the user
// creates a real row.
//
// The button carries its own pending/error affordance so the failure path never blanks the page:
//   idle     → "Create shared map"
//   creating → "Creating…" (aria-disabled + aria-busy; click is a no-op)
//   error    → the button relabels to "Try again" and an inline role="alert" message drops onto its own
//              full-width row below the bar's main row, so it is legible at every width (never clipped
//              into the 52px bar) and never steals width from the title.
//
// Accessibility: we use `aria-disabled` rather than the native `disabled` attribute while creating, so a
// keyboard user's focus is never dropped off the button mid-request; and on failure we refocus the
// (now "Try again") button so the retry is one keypress away. The button is wired to the error via
// aria-describedby so the reason is announced even when focus lands on it after the alert fired.
export function CreateBar({ status, errorMessage, onCreate }: Props) {
  const isError = status === 'error';
  const isCreating = status === 'creating';
  const label = isCreating ? 'Creating…' : isError ? 'Try again' : 'Create shared map';
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isError) btnRef.current?.focus();
  }, [isError]);

  return (
    <div class="map-topbar map-topbar-preview">
      <div class="topbar-main-row">
        <div class="preview-topbar-title">
          <span class="preview-eyebrow">Pennsic Mapper</span>
          <span class="preview-title">Untitled map</span>
        </div>
        <p class="preview-topbar-caption">Create a shared map to start dropping and saving your own pins.</p>
        <button
          ref={btnRef}
          type="button"
          class="button-primary create-map-btn"
          data-testid="create-map"
          aria-disabled={isCreating}
          aria-busy={isCreating}
          aria-describedby={isError ? 'create-gate-error' : undefined}
          onClick={() => {
            if (!isCreating) onCreate();
          }}
        >
          {label}
        </button>
      </div>
      {isError && (
        <p class="topbar-error" id="create-gate-error" role="alert" data-testid="create-error">
          {errorMessage || 'Could not create the map.'}
        </p>
      )}
    </div>
  );
}

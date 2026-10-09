// The purpose of the widget in plain words, shown at the top of the Design tab until dismissed.
// Dismissal is remembered on this device (store.dismissWelcome).

export function WelcomeStrip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section class="welcome" data-testid="welcome-strip" aria-labelledby="welcome-title">
      <div class="welcome-text">
        <h2 id="welcome-title" class="welcome-title">Make your own coat of arms</h2>
        <p>
          Design a personal coat of arms to wear on your nametag, so people can recognise you from across the room.
          Then register it, so nobody else at the event uses the same one.
        </p>
      </div>
      <button type="button" class="button-tertiary welcome-dismiss" data-testid="welcome-dismiss" onClick={onDismiss}>
        Got it
      </button>
    </section>
  );
}

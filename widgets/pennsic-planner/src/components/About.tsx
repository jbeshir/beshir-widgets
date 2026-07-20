interface Props {
  eventName: string;
}

export function About({ eventName }: Props) {
  return (
    <div class="about-view" data-testid="about-view">
      <h2>{eventName} Planner</h2>
      <p>
        A schedule browser and personal planner for{' '}
        <strong>Pennsic War 53</strong> — the Society for Creative Anachronism's
        two-week living history event held each summer near Pittsburgh, Pennsylvania.
        Browse 1,800+ classes, build your personal schedule, detect conflicts, and
        export to your calendar.
      </p>

      <div class="about-notice" role="note">
        <strong>How calendars work:</strong> Star classes to create a calendar — it's stored online and
        reached by a link, with no account. Bookmark the edit link to come back, or share the read-only
        link with friends. The link is the only key, so keep your edit link somewhere safe.
      </div>

      <div class="about-notice" role="note">
        <strong>Data snapshot:</strong> This widget uses the Pennsic 53 class schedule as
        captured on <strong>2026-06-17</strong>. The live schedule at{' '}
        <a href="https://thing.pennsicuniversity.org" target="_blank" rel="noopener">
          thing.pennsicuniversity.org
        </a>{' '}
        is updated continuously — classes may be added, changed, or cancelled after this
        snapshot. Refreshed schedules ship in new releases of the planner.
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-number">1,836</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">14</div>
          <div class="stat-label">Days</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">37</div>
          <div class="stat-label">Tracks</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">115</div>
          <div class="stat-label">Locations</div>
        </div>
      </div>

      <p>
        <strong>Data source:</strong>{' '}
        <a href="https://thing.pennsicuniversity.org" target="_blank" rel="noopener">
          thing.pennsicuniversity.org
        </a>{' '}
        (Pennsic University class calendar export). All class information is copyright
        their respective instructors and the SCA.
      </p>

      <p>
        <strong>Dates:</strong> Pennsic 53 runs July 25 – August 7, 2026.
        Classes follow US Eastern Time (America/New_York).
      </p>
    </div>
  );
}

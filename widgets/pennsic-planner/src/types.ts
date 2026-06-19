// The normalized Pennsic session record. One record per occurrence; repeats are grouped by
// `classId`. Times are Eastern wall-clock (pair with `timezone`); `start`/`end` carry no offset.
export interface Session {
  id: string;
  classId: string;
  title: string;
  instructor: string | null;
  instructorKingdom: string | null;
  track: string;
  topic: string;
  culture: string | null;
  day: string; // YYYY-MM-DD (US Eastern)
  start: string; // ISO local, no offset
  end: string; // ISO local, no offset
  startTime: string; // HH:MM (24h)
  endTime: string; // HH:MM (24h)
  durationMin: number;
  location: string | null;
  description: string | null;
  descriptionBook: string | null;
  adultOnly: boolean;
  adultReason: string | null;
  handoutFee: number | null;
  materialFee: number | null;
  feeItemization: unknown | null;
  hasFee: boolean;
  repeatCount: number;
  timezone: string; // "America/New_York"
  source: string;
  synthetic: boolean;
}

export interface PlacedSession {
  session: Session;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
}

import { solarLongitude } from './astro';

export const CALENDAR_REFERENCE_YEAR = 2026;

export interface CalendarDayTick {
  month: number;
  dayOfMonth: number;
  isFiveDayTick: boolean;
  longitude: number;
}

/** A physical 365-day calendar engraving: February always ends at day 28. */
export function calendarDayTicks(): CalendarDayTick[] {
  const ticks: CalendarDayTick[] = [];
  for (let month = 0; month < 12; month += 1) {
    const daysInMonth = new Date(Date.UTC(CALENDAR_REFERENCE_YEAR, month + 1, 0)).getUTCDate();
    for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
      ticks.push({
        month,
        dayOfMonth,
        isFiveDayTick: dayOfMonth % 5 === 0,
        longitude: solarLongitude(new Date(Date.UTC(CALENDAR_REFERENCE_YEAR, month, dayOfMonth, 12))),
      });
    }
  }
  return ticks;
}

export function calendarMonthStarts(): number[] {
  return Array.from({ length: 12 }, (_, month) => (
    solarLongitude(new Date(Date.UTC(CALENDAR_REFERENCE_YEAR, month, 1, 12)))
  ));
}

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfUtcDay = (value: string | Date): Date => {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const addDays = (value: Date, days: number): Date => new Date(value.getTime() + days * DAY_MS);

const floorDiv = (value: number, divisor: number): number => Math.floor(value / divisor);

export interface BiweeklyPeriod {
  periodStart: string;
  periodEnd: string;
}

export const getBiweeklyPeriod = (anchorFriday: string, asOf: string): BiweeklyPeriod => {
  const anchor = startOfUtcDay(anchorFriday);
  const target = startOfUtcDay(asOf);

  const diffDays = floorDiv(target.getTime() - anchor.getTime(), DAY_MS);
  const cycle = floorDiv(diffDays, 14);

  const periodEndDate = addDays(anchor, cycle * 14);
  const periodStartDate = addDays(periodEndDate, -13);

  return {
    periodStart: toIsoDate(periodStartDate),
    periodEnd: toIsoDate(periodEndDate)
  };
};

export const daysElapsedInPeriod = (periodStart: string, periodEnd: string, asOf: string): number => {
  const start = startOfUtcDay(periodStart);
  const end = startOfUtcDay(periodEnd);
  const target = startOfUtcDay(asOf);
  const effective = target.getTime() > end.getTime() ? end : target;

  if (effective.getTime() < start.getTime()) {
    return 0;
  }

  return floorDiv(effective.getTime() - start.getTime(), DAY_MS) + 1;
};

export const periodIncludesDate = (periodStart: string, periodEnd: string, date: string): boolean => {
  const start = startOfUtcDay(periodStart).getTime();
  const end = startOfUtcDay(periodEnd).getTime();
  const target = startOfUtcDay(date).getTime();
  return target >= start && target <= end;
};

export const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

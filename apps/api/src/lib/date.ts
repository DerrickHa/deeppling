export const nowIso = (): string => new Date().toISOString();

export const addHours = (iso: string, hours: number): string => {
  const date = new Date(iso);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

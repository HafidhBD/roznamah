/** Weeks of 7 ISO dates for a month; null for days outside the month. */
export function monthGrid(year: number, month0: number, weekStart: 0 | 1 | 6): (string | null)[][] {
  const first = new Date(Date.UTC(year, month0, 1, 12));
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0, 12)).getUTCDate();
  const lead = (first.getUTCDay() - weekStart + 7) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(Date.UTC(year, month0, d, 12)).toISOString().slice(0, 10));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

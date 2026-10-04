export function trendData(items: [string, number][]) {
  const sorted = [...items].sort((a, b) => a[0].localeCompare(b[0]));
  const span = sorted.length ? (Date.parse(sorted.at(-1)![0]) - Date.parse(sorted[0][0])) / 86400000 : 0;
  const unit = span > 120 ? 'month' : span > 31 ? 'week' : 'day';
  const buckets = new Map<string, number>();
  for (const [day, count] of sorted) {
    const date = new Date(day + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime())) continue;
    if (unit === 'month') date.setUTCDate(1);
    if (unit === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) || 0) + count);
  }
  return { unit, values: [...buckets.entries()] as [string, number][] };
}

import { text, type Value } from '../types';

export const unclassifiedRequest = 'Belum diklasifikasikan';
export function availableCategory(value: Value, zeroIsMissing = false) {
  const source = text(value).trim();
  return source && (!zeroIsMissing || !/^w?0+$/i.test(source)) ? source : 'Belum tersedia';
}
export function requestCategory(value: Value): 'N' | 'M' | 'U' {
  const source = text(value).trim();
  if (/^(maintenance|maint(?:\b|enance)|m$)/i.test(source)) return 'M';
  if (/^(baru|new(?!.*no new)|n$)/i.test(source)) return 'N';
  return 'U';
}
export function requestCategoryLabel(value: Value) {
  const category = requestCategory(value);
  return category === 'N' ? 'New' : category === 'M' ? 'Maintenance' : unclassifiedRequest;
}

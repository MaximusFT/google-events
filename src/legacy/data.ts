/** Drop absent/empty values while preserving types, array structure and string case. */
export function cleanData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== '').map((item) => cleanData(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item != null && item !== '')
        .map(([key, item]) => [key, cleanData(item)])
    ) as T;
  }
  return value;
}

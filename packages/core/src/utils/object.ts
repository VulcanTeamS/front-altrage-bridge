/**
 * Deep freeze primitive object structures to avoid accidental mutation.
 * Arrays are also frozen to stabilise references.
 *
 * @param value - Object or array to freeze recursively.
 * @returns Same reference with all nested properties frozen.
 */
export const freeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    value.forEach(freeze);
    return Object.freeze(value);
  }

  Object.values(value as Record<string, unknown>).forEach(freeze);
  return Object.freeze(value);
};

// Joins class names, skipping the falsy ones.
export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ');

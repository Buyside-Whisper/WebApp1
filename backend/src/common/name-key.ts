export const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export const nameKeySql = (column: string) =>
  `LOWER(REGEXP_REPLACE(TRIM(${column}), '\\s+', ' ', 'g'))`;

/** Shared UTC-epoch helpers for file timestamps. */

/** Parse "YYYY-MM-DDTHH:MM:SS" (CSV Time / header time) to epoch ms. */
export function epochFromCsvTime(t: string): number | null {
  const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(t.trim())
  if (!m) return null
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
}

/** Parse "YYYY-MM-DDTHHMMSSZ" embedded in a data filename to epoch ms. */
export function epochFromFilename(name: string): number | null {
  const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(name)
  if (!m) return null
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
}

/** Interpolation over committed param series (time in epoch ms). */

export type InterpMethod = 'linear' | 'last' | 'spline'

type XY = { t: number; v: number }

function clean(points: XY[]): XY[] {
  const pts = points
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t)
  // De-duplicate times, keeping the last value.
  const out: XY[] = []
  for (const p of pts) {
    if (out.length > 0 && out[out.length - 1].t === p.t) {
      out[out.length - 1] = p
    } else {
      out.push(p)
    }
  }
  return out
}

/** Natural cubic spline interpolation (clamped at the ends by the caller). */
function cubicSpline(pts: XY[], t: number): number {
  const n = pts.length
  const xs = pts.map((p) => p.t)
  const a = pts.map((p) => p.v)
  const h: number[] = []
  for (let i = 0; i < n - 1; i++) h.push(xs[i + 1] - xs[i])
  const alpha: number[] = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (a[i + 1] - a[i]) - (3 / h[i - 1]) * (a[i] - a[i - 1])
  }
  const l: number[] = new Array(n).fill(1)
  const mu: number[] = new Array(n).fill(0)
  const z: number[] = new Array(n).fill(0)
  const c: number[] = new Array(n).fill(0)
  const b: number[] = new Array(n).fill(0)
  const d: number[] = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1]
    mu[i] = h[i] / l[i]
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i]
  }
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1]
    b[j] = (a[j + 1] - a[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3
    d[j] = (c[j + 1] - c[j]) / (3 * h[j])
  }
  let i = 0
  while (i < n - 2 && t > xs[i + 1]) i++
  const dx = t - xs[i]
  return a[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx
}

/**
 * Interpolate a param series at time `t`. Values outside the series range
 * clamp to the nearest end. Returns null when the series is empty.
 */
export function interpolateSeries(
  points: XY[],
  t: number,
  method: InterpMethod,
): number | null {
  const pts = clean(points)
  if (pts.length === 0) return null
  if (pts.length === 1) return pts[0].v
  if (t <= pts[0].t) return pts[0].v
  const last = pts[pts.length - 1]
  if (t >= last.t) return last.v
  if (method === 'last') {
    let v = pts[0].v
    for (const p of pts) {
      if (p.t <= t) v = p.v
      else break
    }
    return v
  }
  if (method === 'linear') {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / (b.t - a.t)
        return a.v + (b.v - a.v) * f
      }
    }
    return last.v
  }
  return cubicSpline(pts, t)
}

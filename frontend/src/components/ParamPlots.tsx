import { useMemo } from 'react'
import type { HeaderParams, ParamSeriesRow } from '../api'
import type { Params } from '../types'
import { epochFromCsvTime, epochFromFilename } from '../time'
import type { InterpMethod } from '../interp'

export type { InterpMethod }

type ParamPlotsProps = {
  /** Committed CSV rows (numeric params). */
  series: ParamSeriesRow[]
  /** Per-file header times + header params (null when the header lacks them). */
  fileTimes: { name: string; time: string | null; params: HeaderParams }[]
  selectedFile: string | null
  /** Current (possibly uncommitted) working params. */
  current: Params
  interpOn: boolean
  onToggleInterp: (on: boolean) => void
  interpMethod: InterpMethod
  onMethodChange: (method: InterpMethod) => void
}

type Point = { t: number; v: number }

const PLOTS = [
  { key: 'px0', label: 'p0x' },
  { key: 'py0', label: 'p0y' },
  { key: 'px1', label: 'p1x' },
  { key: 'py1', label: 'p1y' },
] as const

type PlotKey = (typeof PLOTS)[number]['key']

function epochForFileTimesEntry(name: string, time: string | null): number | null {
  if (time) {
    const e = epochFromCsvTime(time)
    if (e !== null) return e
  }
  return epochFromFilename(name)
}

function MiniPlot({
  label,
  committed,
  header,
  current,
}: {
  label: string
  committed: Point[]
  header: Point[]
  current: Point | null
}) {
  const W = 300
  const H = 118
  const padL = 6
  const padR = 6
  const padT = 6
  const padB = 16

  const all = current ? [...committed, ...header, current] : [...committed, ...header]
  if (all.length === 0) {
    return (
      <div className="mini-plot">
        <div className="mini-plot-title">{label}</div>
        <div className="mini-plot-empty">No data</div>
      </div>
    )
  }

  let t0 = Math.min(...all.map((p) => p.t))
  let t1 = Math.max(...all.map((p) => p.t))
  if (t1 === t0) t1 = t0 + 1000
  const vs = all.map((p) => p.v).filter((v) => Number.isFinite(v))
  let v0 = Math.min(...vs)
  let v1 = Math.max(...vs)
  if (v1 === v0) {
    const d = Math.abs(v0) * 0.1 || 1
    v0 -= d
    v1 += d
  }

  const X = (t: number) => padL + ((t - t0) / (t1 - t0)) * (W - padL - padR)
  const Y = (v: number) => padT + (1 - (v - v0) / (v1 - v0)) * (H - padT - padB)

  const fmtT = (t: number) => {
    const d = new Date(t)
    const p = (v: number) => String(v).padStart(2, '0')
    return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
  }
  const fmtV = (v: number) => v.toExponential(1)

  const line = committed
    .slice()
    .sort((a, b) => a.t - b.t)
    .map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`)
    .join(' ')

  return (
    <div className="mini-plot">
      <div className="mini-plot-title">{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mini-plot-svg">
        {committed.length > 1 && (
          <polyline points={line} fill="none" stroke="#10b981" strokeWidth={1.5} opacity={0.7} />
        )}
        {header.map((p, i) => (
          <path
            key={`h${i}`}
            d={`M ${X(p.t).toFixed(1)} ${(Y(p.v) - 5).toFixed(1)} L ${(X(p.t) + 4.5).toFixed(1)} ${(Y(p.v) + 3).toFixed(1)} L ${(X(p.t) - 4.5).toFixed(1)} ${(Y(p.v) + 3).toFixed(1)} Z`}
            fill="#f59e0b"
          />
        ))}
        {committed.map((p, i) => (
          <circle key={`c${i}`} cx={X(p.t)} cy={Y(p.v)} r={3} fill="#10b981" />
        ))}
        {current && (
          <circle cx={X(current.t)} cy={Y(current.v)} r={4.5} fill="#22d3ee" stroke="#fff" strokeWidth={1} />
        )}
        <text x={padL} y={H - 4} fontSize={9} fill="#6b7280">
          {fmtT(t0)}
        </text>
        <text x={W - padR} y={H - 4} fontSize={9} fill="#6b7280" textAnchor="end">
          {fmtT(t1)}
        </text>
        <text x={padL} y={padT + 8} fontSize={9} fill="#6b7280">
          {fmtV(v1)}
        </text>
        <text x={padL} y={H - padB} fontSize={9} fill="#6b7280">
          {fmtV(v0)}
        </text>
      </svg>
    </div>
  )
}

export function ParamPlots({
  series,
  fileTimes,
  selectedFile,
  current,
  interpOn,
  onToggleInterp,
  interpMethod,
  onMethodChange,
}: ParamPlotsProps) {
  const committedByKey = useMemo(() => {
    const out: Record<PlotKey, Point[]> = { px0: [], py0: [], px1: [], py1: [] }
    for (const row of series) {
      const t = epochFromCsvTime(row.Time)
      if (t === null) continue
      for (const { key } of PLOTS) {
        const v = row[key]
        if (Number.isFinite(v)) out[key].push({ t, v })
      }
    }
    return out
  }, [series])

  const headerByKey = useMemo(() => {
    const out: Record<PlotKey, Point[]> = { px0: [], py0: [], px1: [], py1: [] }
    for (const entry of fileTimes) {
      const t = epochForFileTimesEntry(entry.name, entry.time)
      if (t === null) continue
      for (const { key } of PLOTS) {
        const v = entry.params[key]
        if (typeof v === 'number' && Number.isFinite(v)) out[key].push({ t, v })
      }
    }
    return out
  }, [fileTimes])

  const selectedEpoch = useMemo(() => {
    if (!selectedFile) return null
    const entry = fileTimes.find((e) => e.name === selectedFile)
    if (!entry) return epochFromFilename(selectedFile)
    return epochForFileTimesEntry(entry.name, entry.time)
  }, [fileTimes, selectedFile])

  return (
    <div className="panel param-plots-panel">
      <div className="panel-title">Fit series</div>
      {PLOTS.map(({ key, label }) => (
        <MiniPlot
          key={key}
          label={label}
          committed={committedByKey[key]}
          header={headerByKey[key]}
          current={selectedEpoch !== null ? { t: selectedEpoch, v: current[key] } : null}
        />
      ))}
      <div className="mini-plot-legend">
        <span>
          <i className="dot committed" /> committed
        </span>
        <span>
          <i className="dot current" /> working
        </span>
        <span>
          <i className="tri header" /> header
        </span>
      </div>
      <div className="interp-controls">
        <label>
          <input
            type="checkbox"
            checked={interpOn}
            onChange={(e) => onToggleInterp(e.target.checked)}
            className="control-checkbox"
          />
          Interpolate
        </label>
        <select
          value={interpMethod}
          onChange={(e) => onMethodChange(e.target.value as InterpMethod)}
          disabled={!interpOn}
          title="Interpolation method"
        >
          <option value="linear">linear</option>
          <option value="last">last</option>
          <option value="spline">spline</option>
        </select>
      </div>
    </div>
  )
}

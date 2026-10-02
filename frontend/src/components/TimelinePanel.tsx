import { useMemo } from 'react'
import { epochFromCsvTime, epochFromFilename } from '../time'

type FileTimeEntry = {
  name: string
  /** Observation time "YYYY-MM-DDTHH:MM:SS" from the file header, or null */
  time: string | null
}

type TimelinePanelProps = {
  fileTimes: FileTimeEntry[]
  selectedFile: string | null
  committedTimes: string[]
  onSelectFile: (filename: string) => void
}

function epochForFile(entry: FileTimeEntry): number | null {
  // Prefer the header-derived time; fall back to the filename timestamp.
  if (entry.time) {
    const e = epochFromCsvTime(entry.time)
    if (e !== null) return e
  }
  return epochFromFilename(entry.name)
}

function formatTick(epoch: number): string {
  const d = new Date(epoch)
  const p = (v: number) => String(v).padStart(2, '0')
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

const TICK_COUNT = 5

export function TimelinePanel({ fileTimes, selectedFile, committedTimes, onSelectFile }: TimelinePanelProps) {
  const committedEpochs = useMemo(() => {
    const s = new Set<number>()
    for (const t of committedTimes) {
      const e = epochFromCsvTime(t)
      if (e !== null) s.add(e)
    }
    return s
  }, [committedTimes])

  const items = useMemo(
    () =>
      fileTimes.flatMap((entry) => {
        const epoch = epochForFile(entry)
        return epoch === null ? [] : [{ name: entry.name, epoch }]
      }),
    [fileTimes],
  )

  const tMin = items.length > 0 ? Math.min(...items.map((i) => i.epoch)) : 0
  const tMax = items.length > 0 ? Math.max(...items.map((i) => i.epoch)) : 0
  const span = tMax - tMin || 1

  const ticks = useMemo(() => {
    if (items.length === 0) return [] as number[]
    return Array.from({ length: TICK_COUNT }, (_, i) => tMin + (span * i) / (TICK_COUNT - 1))
  }, [items.length, tMin, span])

  const committedCount = items.filter((i) => committedEpochs.has(i.epoch)).length

  return (
    <div className="panel timeline-panel">
      <div className="panel-title">Timeline</div>
      {items.length === 0 ? (
        <div className="timeline-empty">No timestamped files</div>
      ) : (
        <>
          <div className="timeline-track">
            <div className="timeline-line" />
            {ticks.map((t) => (
              <div key={t} className="timeline-tick" style={{ left: `${((t - tMin) / span) * 100}%` }}>
                <div className="timeline-tick-mark" />
                <div className="timeline-tick-label">{formatTick(t)}</div>
              </div>
            ))}
            {items.map((item) => {
              const committed = committedEpochs.has(item.epoch)
              const selected = item.name === selectedFile
              const pos = items.length === 1 ? 50 : ((item.epoch - tMin) / span) * 100
              return (
                <button
                  key={item.name}
                  type="button"
                  title={`${item.name}${committed ? ' (committed)' : ''}`}
                  className={`timeline-block${committed ? ' committed' : ' pending'}${selected ? ' selected' : ''}`}
                  style={{ left: `${pos}%` }}
                  onClick={() => onSelectFile(item.name)}
                />
              )
            })}
          </div>
          <div className="timeline-meta">
            <span>
              {committedCount}/{items.length} committed
            </span>
            <span>{selectedFile ?? 'No file selected'}</span>
          </div>
        </>
      )}
    </div>
  )
}

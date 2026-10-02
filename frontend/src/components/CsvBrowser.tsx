import { useCallback, useEffect, useState } from 'react'
import { browseDirectory } from '../api'

type CsvBrowserProps = {
  open: boolean
  onClose: () => void
  onSelect: (path: string) => void
}

export function CsvBrowser({ open, onClose, onSelect }: CsvBrowserProps) {
  const [cwd, setCwd] = useState('')
  const [parent, setParent] = useState<string | null>(null)
  const [dirs, setDirs] = useState<string[]>([])
  const [csvs, setCsvs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (path?: string) => {
    try {
      setError(null)
      const res = await browseDirectory(path)
      setCwd(res.cwd)
      setParent(res.parent)
      setDirs(res.dirs)
      setCsvs(res.csvs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list directory')
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const join = (name: string) => (cwd.endsWith('/') ? `${cwd}${name}` : `${cwd}/${name}`)

  return (
    <div className="browser-overlay" onClick={onClose}>
      <div className="browser-dialog panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Select CSV file</div>
        <div className="browser-path">{cwd}</div>
        {error && <div className="browser-error">{error}</div>}
        <div className="browser-list">
          {parent && (
            <button type="button" className="browser-row" onClick={() => load(parent)}>
              .. (up)
            </button>
          )}
          {dirs.map((d) => (
            <button key={d} type="button" className="browser-row dir" onClick={() => load(join(d))}>
              {d}/
            </button>
          ))}
          {csvs.map((f) => (
            <button
              key={f}
              type="button"
              className="browser-row csv"
              onClick={() => onSelect(join(f))}
            >
              {f}
            </button>
          ))}
          {dirs.length === 0 && csvs.length === 0 && (
            <div className="browser-empty">Empty folder</div>
          )}
        </div>
        <div className="browser-actions">
          <button type="button" className="load-data-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

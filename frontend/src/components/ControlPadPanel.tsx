import type { Params } from '../types'
import { Joystick } from './Joystick'

/** Show only the UTC timestamp token of a data filename, if present. */
function shortFileLabel(name: string | null): string {
  if (!name) return 'No file'
  const m = /(\d{4}-\d{2}-\d{2}T\d{6}Z)/.exec(name)
  return m ? m[1] : name
}

type ControlPadPanelProps = {
  params: Params
  onChangeParams: (params: Params) => void
  onCommit: () => void
  onAuto: () => void
  autoRunning: boolean
  onUncommit: () => void
  selectedFile: string | null
  hasPrevFile: boolean
  hasNextFile: boolean
  onPrevFile: () => void
  onNextFile: () => void
}

export function ControlPadPanel({
  params,
  onChangeParams,
  onCommit,
  onAuto,
  autoRunning,
  onUncommit,
  selectedFile,
  hasPrevFile,
  hasNextFile,
  onPrevFile,
  onNextFile,
}: ControlPadPanelProps) {
  return (
    <div className="panel control-pad-panel">
      <div className="controls-header">
        <div className="panel-title">Control</div>
        <div className="file-nav-buttons">
          <button
            type="button"
            className="file-nav-button"
            title="Previous file"
            disabled={!hasPrevFile}
            onClick={onPrevFile}
          >
            ‹
          </button>
          <button
            type="button"
            className="file-nav-button"
            title="Next file"
            disabled={!hasNextFile}
            onClick={onNextFile}
          >
            ›
          </button>
        </div>
      </div>
      <div className="control-file-row">
        <div className="control-filename" title={selectedFile ?? ''}>
          {shortFileLabel(selectedFile)}
        </div>
      </div>
      <div className="control-actions-row">
        <button
          type="button"
          className="auto-button"
          title="Auto-fit refraction params from quiet-Sun centers"
          onClick={onAuto}
          disabled={autoRunning}
        >
          {autoRunning ? 'Auto…' : 'Auto'}
        </button>
        <button type="button" className="commit-button" onClick={onCommit}>
          Commit
        </button>
        <button
          type="button"
          className="uncommit-button"
          title="Remove the committed CSV row for this file"
          onClick={onUncommit}
          disabled={!selectedFile}
        >
          Un-commit
        </button>
      </div>
      <Joystick
        label="P0"
        x={params.px0}
        y={params.py0}
        xRange={[-2e19, 2e19]}
        yRange={[-2e19, 2e19]}
        onChange={(px0, py0) => onChangeParams({ ...params, px0, py0 })}
        onReset={() => onChangeParams({ ...params, px0: 0, py0: 0 })}
      />
      <Joystick
        label="P1"
        x={params.px1}
        y={params.py1}
        xRange={[-3000, 3000]}
        yRange={[-3000, 3000]}
        onChange={(px1, py1) => onChangeParams({ ...params, px1, py1 })}
        onReset={() => onChangeParams({ ...params, px1: 0, py1: 0 })}
      />
    </div>
  )
}

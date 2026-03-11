import type { Params } from '../types'
import { Joystick } from './Joystick'

type ControlPadPanelProps = {
  params: Params
  onChangeParams: (params: Params) => void
  onCommit: () => void
  hasPrevFile: boolean
  hasNextFile: boolean
  onPrevFile: () => void
  onNextFile: () => void
}

export function ControlPadPanel({
  params,
  onChangeParams,
  onCommit,
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
        <button type="button" className="commit-button" onClick={onCommit}>
          Commit
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

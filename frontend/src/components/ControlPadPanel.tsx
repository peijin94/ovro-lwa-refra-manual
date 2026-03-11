import type { Params } from '../types'
import { Joystick } from './Joystick'

type ControlPadPanelProps = {
  params: Params
  onChangeParams: (params: Params) => void
  onCommit: () => void
  availableFiles: string[]
  selectedFile: string | null
  onChangeSelectedFile: (filename: string) => void
}

export function ControlPadPanel({
  params,
  onChangeParams,
  onCommit,
  availableFiles,
  selectedFile,
  onChangeSelectedFile,
}: ControlPadPanelProps) {
  const currentIndex = selectedFile ? availableFiles.indexOf(selectedFile) : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < availableFiles.length - 1
  const goPrev = () => {
    if (hasPrev) onChangeSelectedFile(availableFiles[currentIndex - 1])
  }
  const goNext = () => {
    if (hasNext) onChangeSelectedFile(availableFiles[currentIndex + 1])
  }

  return (
    <div className="panel control-pad-panel">
      <div className="controls-header">
        <div className="panel-title">Control</div>
        <div className="file-nav-buttons">
          <button
            type="button"
            className="file-nav-button"
            title="Previous file"
            disabled={!hasPrev}
            onClick={goPrev}
          >
            ‹
          </button>
          <button
            type="button"
            className="file-nav-button"
            title="Next file"
            disabled={!hasNext}
            onClick={goNext}
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

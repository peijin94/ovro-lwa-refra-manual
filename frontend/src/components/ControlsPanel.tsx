import { useEffect, useState } from 'react'
import type { ChannelRange, Params } from '../types'
import { Joystick } from './Joystick'

type ControlsPanelProps = {
  params: Params
  onChangeParams: (params: Params) => void
  contourValue: number
  onChangeContourValue: (value: number) => void
  valuePowerIndex: number
  onChangeValuePowerIndex: (value: number) => void
  channelRange: ChannelRange
  onChangeChannelRange: (range: ChannelRange) => void
  channelCadence: number
  onChangeChannelCadence: (value: number) => void
  maxChannelIndex: number
  availableFiles: string[]
  selectedFile: string | null
  onChangeSelectedFile: (filename: string) => void
  drawSun: boolean
  onChangeDrawSun: (value: boolean) => void
}

export function ControlsPanel({
  params,
  onChangeParams,
  contourValue,
  onChangeContourValue,
  valuePowerIndex,
  onChangeValuePowerIndex,
  channelRange,
  onChangeChannelRange,
  channelCadence,
  onChangeChannelCadence,
  maxChannelIndex,
  availableFiles,
  selectedFile,
  onChangeSelectedFile,
  drawSun,
  onChangeDrawSun,
}: ControlsPanelProps) {
  const [localContourValue, setLocalContourValue] = useState<number>(contourValue)

  useEffect(() => {
    setLocalContourValue(contourValue)
  }, [contourValue])
  const handleP0Change = (px0: number, py0: number) => {
    onChangeParams({ ...params, px0, py0 })
  }

  const handleP1Change = (px1: number, py1: number) => {
    onChangeParams({ ...params, px1, py1 })
  }

  const handleChannelRangeChange = (key: 'start' | 'end', value: number) => {
    const clamped = Math.min(Math.max(0, Math.floor(value)), maxChannelIndex)
    const next: ChannelRange = { ...channelRange, [key]: clamped }
    if (next.start > next.end) {
      if (key === 'start') {
        next.end = clamped
      } else {
        next.start = clamped
      }
    }
    onChangeChannelRange(next)
  }

  return (
    <div className="panel controls-root">
      <div className="panel-title">Controls</div>
      <Joystick
        label="Control P0"
        x={params.px0}
        y={params.py0}
        xRange={[-2e19, 2e19]}
        yRange={[-2e19, 2e19]}
        onChange={handleP0Change}
        onReset={() => onChangeParams({ ...params, px0: 0, py0: 0 })}
      />
      <Joystick
        label="Control P1"
        x={params.px1}
        y={params.py1}
        xRange={[-3000, 3000]}
        yRange={[-3000, 3000]}
        onChange={handleP1Change}
        onReset={() => onChangeParams({ ...params, px1: 0, py1: 0 })}
      />

      <div className="control-pad">
        <div className="control-field">
          <label htmlFor="data-file">Data file</label>
          <select
            id="data-file"
            value={selectedFile ?? ''}
            onChange={(e) => onChangeSelectedFile(e.target.value)}
          >
            {availableFiles.length === 0 && <option value="">No files found</option>}
            {availableFiles.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="control-field">
          <label htmlFor="contour-value">Contour value</label>
          <input
            id="contour-value"
            type="number"
            value={Number.isFinite(localContourValue) ? localContourValue : 0}
            onChange={(e) => setLocalContourValue(Number(e.target.value))}
            onBlur={() => onChangeContourValue(localContourValue)}
          />
        </div>
        <div className="control-field">
          <label htmlFor="value-power-index">Power-index</label>
          <input
            id="value-power-index"
            type="number"
            value={valuePowerIndex}
            onChange={(e) => onChangeValuePowerIndex(Number(e.target.value))}
          />
        </div>
        <div className="control-field">
          <label htmlFor="draw-sun">
            <input
              id="draw-sun"
              type="checkbox"
              checked={drawSun}
              onChange={(e) => onChangeDrawSun(e.target.checked)}
              style={{ marginRight: '0.35rem' }}
            />
            Draw Sun R = 1
          </label>
        </div>
        <div className="control-field">
          <label>Channel range</label>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <input
              type="number"
              min={0}
              max={maxChannelIndex}
              value={channelRange.start}
              onChange={(e) => handleChannelRangeChange('start', Number(e.target.value))}
            />
            <input
              type="number"
              min={0}
              max={maxChannelIndex}
              value={channelRange.end}
              onChange={(e) => handleChannelRangeChange('end', Number(e.target.value))}
            />
          </div>
        </div>
        <div className="control-field">
          <label htmlFor="channel-cadence">Channel cadence</label>
          <input
            id="channel-cadence"
            type="number"
            min={1}
            value={channelCadence}
            onChange={(e) => onChangeChannelCadence(Math.max(1, Number(e.target.value)))}
          />
        </div>
      </div>
      <div className="control-caption">Use P0 and P1 joysticks to align contours across frequency.</div>
    </div>
  )
}


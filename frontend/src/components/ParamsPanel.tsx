import { useEffect, useState } from 'react'
import type { ChannelRange } from '../types'

type ParamsPanelProps = {
  contourValue: number
  onChangeContourValue: (value: number) => void
  valuePowerIndex: number
  onChangeValuePowerIndex: (value: number) => void
  channelRange: ChannelRange
  onChangeChannelRange: (range: ChannelRange) => void
  channelCadence: number
  onChangeChannelCadence: (value: number) => void
  maxChannelIndex: number
  drawSun: boolean
  onChangeDrawSun: (value: boolean) => void
}

export function ParamsPanel({
  contourValue,
  onChangeContourValue,
  valuePowerIndex,
  onChangeValuePowerIndex,
  channelRange,
  onChangeChannelRange,
  channelCadence,
  onChangeChannelCadence,
  maxChannelIndex,
  drawSun,
  onChangeDrawSun,
}: ParamsPanelProps) {
  const [localContourValue, setLocalContourValue] = useState<number>(contourValue)
  const [localPowerIndex, setLocalPowerIndex] = useState<number>(valuePowerIndex)

  useEffect(() => {
    setLocalContourValue(contourValue)
  }, [contourValue])

  useEffect(() => {
    setLocalPowerIndex(valuePowerIndex)
  }, [valuePowerIndex])

  const handleChannelRangeChange = (key: 'start' | 'end', value: number) => {
    const clamped = Math.min(Math.max(0, Math.floor(value)), maxChannelIndex)
    const next: ChannelRange = { ...channelRange, [key]: clamped }
    if (next.start > next.end) {
      if (key === 'start') next.end = clamped
      else next.start = clamped
    }
    onChangeChannelRange(next)
  }

  return (
    <div className="panel params-panel">
      <div className="panel-title">Param</div>
      <div className="params-panel-fields">
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
            value={Number.isFinite(localPowerIndex) ? localPowerIndex : 0}
            onChange={(e) => setLocalPowerIndex(Number(e.target.value))}
            onBlur={() => onChangeValuePowerIndex(localPowerIndex)}
          />
        </div>
        <div className="control-field">
          <label htmlFor="draw-sun">
            <input
              id="draw-sun"
              type="checkbox"
              checked={drawSun}
              onChange={(e) => onChangeDrawSun(e.target.checked)}
              className="control-checkbox"
            />
            Draw Sun R = 1
          </label>
        </div>
        <div className="control-field">
          <label>Channel range</label>
          <div className="channel-range-inputs">
            <input
              type="number"
              min={0}
              max={maxChannelIndex}
              value={channelRange.start}
              title="Channel range start"
              onChange={(e) => handleChannelRangeChange('start', Number(e.target.value))}
            />
            <input
              type="number"
              min={0}
              max={maxChannelIndex}
              value={channelRange.end}
              title="Channel range end"
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
    </div>
  )
}

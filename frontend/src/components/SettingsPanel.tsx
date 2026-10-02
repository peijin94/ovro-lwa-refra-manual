import { useEffect, useState } from 'react'
import type { ChannelRange } from '../types'

type SettingsPanelProps = {
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

const CONTOUR_MIN = 0
const CONTOUR_MAX = 1e6
const CONTOUR_STEP = 1000

const POWER_MIN = -1
const POWER_MAX = 1
const POWER_STEP = 0.01

const clampNum = (v: number, lo: number, hi: number, fallback: number): number =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback

export function SettingsPanel({
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
}: SettingsPanelProps) {
  const [localContourValue, setLocalContourValue] = useState<number>(contourValue)
  const [localPowerIndex, setLocalPowerIndex] = useState<number>(valuePowerIndex)

  useEffect(() => {
    setLocalContourValue(contourValue)
  }, [contourValue])

  useEffect(() => {
    setLocalPowerIndex(valuePowerIndex)
  }, [valuePowerIndex])

  const commitContourValue = () => {
    // Never commit NaN upstream; it would fail backend validation
    // and leave the UI showing contours for a stale value.
    if (Number.isFinite(localContourValue)) onChangeContourValue(localContourValue)
    else setLocalContourValue(contourValue)
  }

  const commitPowerIndex = () => {
    if (Number.isFinite(localPowerIndex)) onChangeValuePowerIndex(localPowerIndex)
    else setLocalPowerIndex(valuePowerIndex)
  }

  const handleChannelRangeChange = (key: 'start' | 'end', value: number) => {
    if (!Number.isFinite(value)) return
    const clamped = Math.min(Math.max(0, Math.floor(value)), maxChannelIndex)
    const next: ChannelRange = { ...channelRange, [key]: clamped }
    if (next.start > next.end) {
      if (key === 'start') next.end = clamped
      else next.start = clamped
    }
    onChangeChannelRange(next)
  }

  return (
    <div className="panel settings-panel">
      <div className="panel-title">Settings</div>
      <div className="settings-panel-fields">
        <div className="control-field">
          <label htmlFor="contour-value">Contour value</label>
          <div className="slider-row">
            <input
              type="range"
              aria-label="Contour value slider"
              min={CONTOUR_MIN}
              max={CONTOUR_MAX}
              step={CONTOUR_STEP}
              value={clampNum(localContourValue, CONTOUR_MIN, CONTOUR_MAX, CONTOUR_MIN)}
              onChange={(e) => setLocalContourValue(Number(e.target.value))}
              onPointerUp={commitContourValue}
              onKeyUp={commitContourValue}
            />
            <input
              id="contour-value"
              type="number"
              value={Number.isFinite(localContourValue) ? localContourValue : 0}
              onChange={(e) => setLocalContourValue(Number(e.target.value))}
              onBlur={commitContourValue}
            />
          </div>
        </div>
        <div className="control-field">
          <label htmlFor="value-power-index">Power-index</label>
          <div className="slider-row">
            <input
              type="range"
              aria-label="Power-index slider"
              min={POWER_MIN}
              max={POWER_MAX}
              step={POWER_STEP}
              value={clampNum(localPowerIndex, POWER_MIN, POWER_MAX, 0)}
              onChange={(e) => setLocalPowerIndex(Number(e.target.value))}
              onPointerUp={commitPowerIndex}
              onKeyUp={commitPowerIndex}
            />
            <input
              id="value-power-index"
              type="number"
              value={Number.isFinite(localPowerIndex) ? localPowerIndex : 0}
              onChange={(e) => setLocalPowerIndex(Number(e.target.value))}
              onBlur={commitPowerIndex}
            />
          </div>
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
            Draw Sun R⊙
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
            onChange={(e) => {
              const v = Math.floor(Number(e.target.value))
              if (Number.isFinite(v)) onChangeChannelCadence(Math.max(1, v))
            }}
          />
        </div>
      </div>
    </div>
  )
}

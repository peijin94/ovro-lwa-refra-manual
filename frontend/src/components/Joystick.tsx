import type { PointerEvent } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'

type JoystickProps = {
  label: string
  x: number
  y: number
  xRange: [number, number]
  yRange: [number, number]
  onChange: (x: number, y: number) => void
  onReset?: () => void
}

const RADIUS = 60
const INNER_RADIUS = 16
const CENTER = { x: 75, y: 75 }

export function Joystick({ label, x, y, xRange, yRange, onChange, onReset }: JoystickProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [offset, setOffset] = useState<{ nx: number; ny: number }>({ nx: 0, ny: 0 })
  const baseValueRef = useRef<{ x: number; y: number }>({ x, y })

  const handlePos = useMemo(
    () => ({
      x: CENTER.x + offset.nx * RADIUS,
      // Positive ny moves the dot visually downward, matching cursor motion.
      y: CENTER.y + offset.ny * RADIUS,
    }),
    [offset],
  )

  const computeDeltaAndUpdate = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return

      const point = svg.createSVGPoint()
      point.x = event.clientX
      point.y = event.clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const svgP = point.matrixTransform(ctm.inverse())

      const dx = svgP.x - CENTER.x
      const dy = svgP.y - CENTER.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const clampedDist = Math.min(dist, RADIUS)
      const nx = (dx / dist) * (clampedDist / RADIUS)
      const ny = (dy / dist) * (clampedDist / RADIUS)

      setOffset({ nx, ny })

      // Interpret this as a relative change around the value at drag start.
      const spanX = xRange[1] - xRange[0]
      const spanY = yRange[1] - yRange[0]
      const scale = 0.1
      const deltaX = nx * spanX * scale
      const deltaY = -ny * spanY * scale

      const base = baseValueRef.current
      const newX = Math.min(xRange[1], Math.max(xRange[0], base.x + deltaX))
      const newY = Math.min(yRange[1], Math.max(yRange[0], base.y + deltaY))
      onChange(newX, newY)
    },
    [onChange, xRange, yRange],
  )

  const onPointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      event.preventDefault()
      baseValueRef.current = { x, y }
      const svg = event.currentTarget
      svg.setPointerCapture(event.pointerId)
      computeDeltaAndUpdate(event)
    },
    [computeDeltaAndUpdate, x, y],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.buttons === 0) return
      computeDeltaAndUpdate(event)
    },
    [computeDeltaAndUpdate],
  )

  const onPointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    // Return stick visually to center after drag ends.
    setOffset({ nx: 0, ny: 0 })
  }, [])

  return (
    <div className="joystick-row">
      <div className="joystick-label">
        <span>{label}</span>
        {onReset && (
          <button
            type="button"
            className="joystick-reset"
            onClick={onReset}
          >
            Reset
          </button>
        )}
      </div>
      <div className="joystick-grid">
        <svg
          className="joystick-svg"
          viewBox="0 0 150 150"
          ref={svgRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <defs>
            <radialGradient id="joystick-bg" cx="30%" cy="20%" r="80%">
              <stop offset="0%" stopColor="#111827" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>
          </defs>
          <circle cx={CENTER.x} cy={CENTER.y} r={RADIUS} fill="url(#joystick-bg)" stroke="#4b5563" strokeWidth={2} />
          <circle
            cx={handlePos.x}
            cy={handlePos.y}
            r={INNER_RADIUS}
            fill="#22d3ee"
            stroke="#0f172a"
            strokeWidth={2}
          />
        </svg>
        <div className="param-inputs">
          <label>
            <span>Px</span>
            <input
              type="number"
              value={x}
              onChange={(e) => onChange(Number(e.target.value), y)}
            />
          </label>
          <label>
            <span>Py</span>
            <input
              type="number"
              value={y}
              onChange={(e) => onChange(x, Number(e.target.value))}
            />
          </label>
        </div>
      </div>
    </div>
  )
}


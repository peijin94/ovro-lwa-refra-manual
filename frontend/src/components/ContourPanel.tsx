import { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import type { ChannelRange, MultiChannelData, Params } from '../types'

type ContourPanelProps = {
  data: MultiChannelData
  params: Params
  channelRange: ChannelRange
  channelCadence: number
  drawSun: boolean
}

function jetColor(t: number): string {
  // Clamp t to [0, 1]
  const tt = Math.max(0, Math.min(1, t))
  // Simple jet-like approximation
  const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * tt - 3)))
  const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * tt - 2)))
  const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * tt - 1)))
  return d3.rgb(r * 255, g * 255, b * 255).formatHex()
}

export function ContourPanel({
  data,
  params,
  channelRange,
  channelCadence,
  drawSun,
}: ContourPanelProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)

  const selectedContours = useMemo(() => {
    const { px0, py0, px1, py1 } = params

    const channelsInRange = data.channels.filter(
      (ch) => ch.index >= channelRange.start && ch.index <= channelRange.end,
    )

    const sampledChannels = channelsInRange.filter((_, idx) => idx % Math.max(1, channelCadence) === 0)

    const items: {
      channelIndex: number
      freqHz: number
      colorKey: number
      points: { x: number; y: number }[]
    }[] = []

    for (const ch of sampledChannels) {
      const contoursForChannel = data.contours.filter((c) => c.channelId === ch.id)

      const invF2 = 1 / (ch.freqHz * ch.freqHz)
      const xOffset = px0 * invF2 + px1
      const yOffset = py0 * invF2 + py1

      for (const contour of contoursForChannel) {
        const shiftedPoints = contour.points.map((p) => ({
          x: p.x + xOffset,
          y: p.y + yOffset,
        }))
        items.push({
          channelIndex: ch.index,
          freqHz: ch.freqHz,
          colorKey: ch.index,
          points: shiftedPoints,
        })
      }
    }

    return items
  }, [data, params, channelRange, channelCadence])

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    const rect = svgEl.getBoundingClientRect()
    const width = rect.width || 400
    const height = rect.height || 400
    const size = Math.min(width, height)
    svg.attr('viewBox', `0 0 ${size} ${size}`)

    if (selectedContours.length === 0) {
      const text = svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .attr('font-size', 14)
      text.text('No contours at this range')
      return
    }

    const xScale = d3
      .scaleLinear()
      .domain([-6000, 6000])
      .range([40, size - 10])

    const yScale = d3
      .scaleLinear()
      .domain([-6000, 6000])
      .range([size - 30, 10])

    // Build a jet-like colormap over channel indices.
    const uniqueChannels = Array.from(new Set(selectedContours.map((c) => c.channelIndex))).sort(
      (a, b) => a - b,
    )
    const nChan = uniqueChannels.length || 1
    const channelToColor = new Map<number, string>()
    uniqueChannels.forEach((chIdx, i) => {
      const t = nChan === 1 ? 0.5 : i / (nChan - 1)
      channelToColor.set(chIdx, jetColor(t))
    })

    const line = d3
      .line<{ x: number; y: number }>()
      .x((p) => xScale(p.x))
      .y((p) => yScale(p.y))
      .curve(d3.curveCatmullRom.alpha(0.5))

    svg
      .append('rect')
      .attr('x', 32)
      .attr('y', 4)
      .attr('width', size - 42)
      .attr('height', size - 40)
      .attr('fill', 'none')
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1)

    const g = svg.append('g')

    g.selectAll('path')
      .data(selectedContours)
      .enter()
      .append('path')
      .attr('d', (d) => line(d.points) ?? '')
      .attr('fill', 'none')
      .attr('stroke', (d) => channelToColor.get(d.channelIndex) ?? '#22d3ee')
      .attr('stroke-width', 1.2)
      .attr('opacity', 0.9)

    // Optional solar disk at R = 960 arcsec.
    if (drawSun) {
      const sunGroup = svg.append('g')
      const cx = xScale(0)
      const cy = yScale(0)
      const r = Math.abs(xScale(960) - xScale(0))
      sunGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.9)
    }
  }, [selectedContours])

  return (
    <div className="panel">
      <div className="panel-title">Contours</div>
      <div className="contour-svg-wrapper">
        <div className="contour-svg-inner">
          <svg ref={svgRef} className="contour-svg" />
        </div>
      </div>
    </div>
  )
}


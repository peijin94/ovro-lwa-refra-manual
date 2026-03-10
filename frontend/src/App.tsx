import { useEffect, useMemo, useState } from 'react'
import { fetchDataFiles, fetchMultiChannelData } from './api'
import type { ChannelRange, MultiChannelData, Params } from './types'
import { ContourPanel } from './components/ContourPanel'
import { ControlsPanel } from './components/ControlsPanel'
import './App.css'

const DEFAULT_PARAMS: Params = {
  px0: 0,
  py0: 0,
  px1: 0,
  py1: 0,
}

const DEFAULT_CHANNEL_RANGE: ChannelRange = {
  start: 0,
  end: 0,
}

const DEFAULT_CONTOUR_VALUE = 2e5
const DEFAULT_VALUE_POWER_INDEX = -0.1
const DEFAULT_CHANNEL_CADENCE = 5

function App() {
  const [data, setData] = useState<MultiChannelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [contourValue, setContourValue] = useState<number>(DEFAULT_CONTOUR_VALUE)
  const [valuePowerIndex, setValuePowerIndex] = useState<number>(DEFAULT_VALUE_POWER_INDEX)
  const [channelRange, setChannelRange] = useState<ChannelRange>(DEFAULT_CHANNEL_RANGE)
  const [channelCadence, setChannelCadence] = useState<number>(DEFAULT_CHANNEL_CADENCE)
  const [drawSun, setDrawSun] = useState<boolean>(true)

  // Load list of available HDF files once on mount.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const files = await fetchDataFiles()
        if (cancelled) return
        setAvailableFiles(files)
        if (files.length > 0) {
          setSelectedFile(files[0])
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Whenever the selected file changes, load its contour data.
  useEffect(() => {
    if (!selectedFile) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const result = await fetchMultiChannelData(selectedFile, contourValue, valuePowerIndex)
        if (cancelled) return
        setData(result)
        if (result.channels.length > 0) {
          const n = result.channels.length
          const startIdx = Math.floor(0.2 * n)
          setChannelRange({
            start: startIdx,
            end: result.channels.length - 1,
          })
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedFile, contourValue, valuePowerIndex])

  const derivedState = useMemo(
    () => ({
      hasData: !!data && data.channels.length > 0,
    }),
    [data],
  )

  if (error) {
    return (
      <div className="app-root">
        <p>Failed to load contour data.</p>
        <pre>{error}</pre>
      </div>
    )
  }

  if (loading) {
    return <div className="app-root">Loading contour data…</div>
  }

  if (!derivedState.hasData || !data || !selectedFile) {
    return <div className="app-root">No contour data available.</div>
  }

  return (
    <div className="app-root">
      <div className="app-main">
        <ContourPanel
          data={data}
          params={params}
          channelRange={channelRange}
          channelCadence={channelCadence}
          drawSun={drawSun}
        />
        <ControlsPanel
          params={params}
          onChangeParams={setParams}
          contourValue={contourValue}
          onChangeContourValue={setContourValue}
          valuePowerIndex={valuePowerIndex}
          onChangeValuePowerIndex={setValuePowerIndex}
          channelRange={channelRange}
          onChangeChannelRange={setChannelRange}
          channelCadence={channelCadence}
          onChangeChannelCadence={setChannelCadence}
          maxChannelIndex={data.channels.length - 1}
          availableFiles={availableFiles}
          selectedFile={selectedFile}
          onChangeSelectedFile={setSelectedFile}
          drawSun={drawSun}
          onChangeDrawSun={setDrawSun}
        />
      </div>
    </div>
  )
}

export default App

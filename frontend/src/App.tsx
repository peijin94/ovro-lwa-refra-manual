import { useEffect, useMemo, useState } from 'react'
import {
  commitParams,
  fetchDataFiles,
  fetchDataRoot,
  fetchMultiChannelData,
  fetchOutputFile,
  loadParamsForFile,
  setOutputFile,
} from './api'
import type { ChannelRange, MultiChannelData, Params } from './types'
import { ContourPanel } from './components/ContourPanel'
import { ControlPadPanel } from './components/ControlPadPanel'
import { FilePanel } from './components/FilePanel'
import { ParamsPanel } from './components/ParamsPanel'
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
  const [dataRoot, setDataRoot] = useState<string>('')
  const [outputFile, setOutputFileState] = useState<string>('')

  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [contourValue, setContourValue] = useState<number>(DEFAULT_CONTOUR_VALUE)
  const [valuePowerIndex, setValuePowerIndex] = useState<number>(DEFAULT_VALUE_POWER_INDEX)
  const [channelRange, setChannelRange] = useState<ChannelRange>(DEFAULT_CHANNEL_RANGE)
  const [channelCadence, setChannelCadence] = useState<number>(DEFAULT_CHANNEL_CADENCE)
  const [drawSun, setDrawSun] = useState<boolean>(true)
  const [autoLoadParams, setAutoLoadParams] = useState<boolean>(false)

  // Load list of available HDF files once on mount.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [root, files, outfile] = await Promise.all([
          fetchDataRoot(),
          fetchDataFiles(),
          fetchOutputFile(),
        ])
        if (cancelled) return
        setDataRoot(root)
        setOutputFileState(outfile)
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

  const handleChangeOutputFile = async () => {
    const current = outputFile || './manual_corr.csv'
    const next = window.prompt('Enter output CSV file path', current)
    if (!next || next === current) return
    try {
      const updated = await setOutputFile(next)
      setOutputFileState(updated)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error updating output file'
      setError(message)
    }
  }

  const handleCommit = async () => {
    if (!selectedFile) return
    try {
      await commitParams(params, selectedFile)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error committing parameters'
      setError(message)
    }
  }

  // When auto-load is enabled, pull params from CSV based on the selected file's timestamp.
  useEffect(() => {
    if (!autoLoadParams || !selectedFile) return

    let cancelled = false
    ;(async () => {
      try {
        const loaded = await loadParamsForFile(selectedFile)
        if (cancelled || !loaded) return
        setParams(loaded)
      } catch {
        // Ignore load failures; user can still adjust params manually.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [autoLoadParams, selectedFile])

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
        <div className="app-right">
          <div className="app-right-top">
            <ControlPadPanel
              params={params}
              onChangeParams={setParams}
              onCommit={handleCommit}
              availableFiles={availableFiles}
              selectedFile={selectedFile}
              onChangeSelectedFile={setSelectedFile}
            />
            <ParamsPanel
              contourValue={contourValue}
              onChangeContourValue={setContourValue}
              valuePowerIndex={valuePowerIndex}
              onChangeValuePowerIndex={setValuePowerIndex}
              channelRange={channelRange}
              onChangeChannelRange={setChannelRange}
              channelCadence={channelCadence}
              onChangeChannelCadence={setChannelCadence}
              maxChannelIndex={data.channels.length - 1}
              drawSun={drawSun}
              onChangeDrawSun={setDrawSun}
            />
          </div>
          <FilePanel
            dataRoot={dataRoot}
            availableFiles={availableFiles}
            selectedFile={selectedFile}
            onChangeSelectedFile={setSelectedFile}
            outputFile={outputFile}
            onChangeOutputFile={handleChangeOutputFile}
            autoLoadParams={autoLoadParams}
            onChangeAutoLoadParams={setAutoLoadParams}
          />
        </div>
      </div>
    </div>
  )
}

export default App

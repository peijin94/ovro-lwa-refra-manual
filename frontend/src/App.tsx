import { useEffect, useState } from 'react'
import {
  commitParams,
  fetchDataFiles,
  fetchDataRoot,
  fetchMultiChannelData,
  fetchOutputFile,
  loadParamsForFile,
  setDataRoot as setDataRootApi,
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

const EMPTY_MULTI_CHANNEL_DATA: MultiChannelData = {
  channels: [],
  contours: [],
  spatialExtent: { xMin: 0, xMax: 0, yMin: 0, yMax: 0 },
}

function App() {
  const [data, setData] = useState<MultiChannelData | null>(null)

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

  const currentIndex = selectedFile ? availableFiles.indexOf(selectedFile) : -1
  const hasPrevFile = currentIndex > 0
  const hasNextFile = currentIndex >= 0 && currentIndex < availableFiles.length - 1

  const goPrevFile = () => {
    if (!hasPrevFile) return
    setSelectedFile(availableFiles[currentIndex - 1])
  }

  const goNextFile = () => {
    if (!hasNextFile) return
    setSelectedFile(availableFiles[currentIndex + 1])
  }

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
      } catch {
        if (cancelled) return
        window.alert('Failed to load initial data files. Check that the backend is running.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Whenever the selected file changes, load its contour data.
  useEffect(() => {
    if (!selectedFile) {
      return
    }

    let cancelled = false
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
      } catch {
        if (cancelled) return
        window.alert('Failed to load contour data for this file.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedFile, contourValue, valuePowerIndex])

  const handleChangeOutputFile = async () => {
    const current = outputFile || './manual_corr.csv'
    const next = window.prompt('Enter output CSV file path', current)
    if (!next || next === current) return
    try {
      const updated = await setOutputFile(next)
      setOutputFileState(updated)
    } catch {
      window.alert('Failed to update output file path.')
    }
  }

  const handleCommit = async () => {
    if (!selectedFile) return
    try {
      await commitParams(params, selectedFile)
    } catch {
      window.alert('Failed to commit parameters.')
    }
  }

  const handleEditDataRootValue = (path: string) => {
    setDataRoot(path)
  }

  const handleApplyDataRoot = async () => {
    const next = dataRoot.trim()
    if (!next) return
    try {
      const updatedRoot = await setDataRootApi(next)
      setDataRoot(updatedRoot)
      const files = await fetchDataFiles()
      setAvailableFiles(files)
      if (files.length > 0) {
        setSelectedFile(files[0])
      } else {
        setSelectedFile(null)
        setData(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error updating data root'
      window.alert(message)
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return
        }
      }
      if (event.key === 'ArrowLeft') {
        goPrevFile()
      } else if (event.key === 'ArrowRight') {
        goNextFile()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [goPrevFile, goNextFile])

  const contourData = data ?? EMPTY_MULTI_CHANNEL_DATA

  return (
    <div className="app-root">
      <div className="app-main">
        <ContourPanel
          data={contourData}
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
              hasPrevFile={hasPrevFile}
              hasNextFile={hasNextFile}
              onPrevFile={goPrevFile}
              onNextFile={goNextFile}
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
              maxChannelIndex={contourData.channels.length - 1}
              drawSun={drawSun}
              onChangeDrawSun={setDrawSun}
            />
          </div>
          <FilePanel
            dataRoot={dataRoot}
            availableFiles={availableFiles}
            selectedFile={selectedFile}
            onChangeSelectedFile={setSelectedFile}
            onChangeDataRootValue={handleEditDataRootValue}
            onApplyDataRoot={handleApplyDataRoot}
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

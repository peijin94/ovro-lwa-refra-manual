import { useEffect, useState } from 'react'
import {
  autoFit,
  commitParams,
  fetchCommittedTimes,
  fetchDataFiles,
  fetchDataRoot,
  fetchFileTimes,
  fetchMultiChannelData,
  fetchOutputFile,
  fetchParamSeries,
  setDataRoot as setDataRootApi,
  setOutputFile,
  uncommit,
  updateAllHeaders,
  updateHeader,
} from './api'
import type { FileTimeInfo, ParamSeriesRow } from './api'
import type { ChannelRange, MultiChannelData, Params } from './types'
import { interpolateSeries } from './interp'
import type { InterpMethod } from './interp'
import { epochFromCsvTime, epochFromFilename } from './time'
import { ContourPanel } from './components/ContourPanel'
import { ControlPadPanel } from './components/ControlPadPanel'
import { CsvBrowser } from './components/CsvBrowser'
import { FilePanel } from './components/FilePanel'
import { SettingsPanel } from './components/SettingsPanel'
import { ParamPlots } from './components/ParamPlots'
import { TimelinePanel } from './components/TimelinePanel'
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

const INTERP_KEYS = ['px0', 'py0', 'px1', 'py1'] as const

function App() {
  const [data, setData] = useState<MultiChannelData | null>(null)

  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [fileTimes, setFileTimes] = useState<FileTimeInfo[]>([])
  const [committedTimes, setCommittedTimes] = useState<string[]>([])
  const [paramSeries, setParamSeries] = useState<ParamSeriesRow[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [dataRoot, setDataRoot] = useState<string>('')
  const [outputFile, setOutputFileState] = useState<string>('')
  const [csvBrowserOpen, setCsvBrowserOpen] = useState(false)
  const [autoRunning, setAutoRunning] = useState(false)
  const [interpOn, setInterpOn] = useState(false)
  const [interpMethod, setInterpMethod] = useState<InterpMethod>('linear')

  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [contourValue, setContourValue] = useState<number>(DEFAULT_CONTOUR_VALUE)
  const [valuePowerIndex, setValuePowerIndex] = useState<number>(DEFAULT_VALUE_POWER_INDEX)
  const [channelRange, setChannelRange] = useState<ChannelRange>(DEFAULT_CHANNEL_RANGE)
  const [channelCadence, setChannelCadence] = useState<number>(DEFAULT_CHANNEL_CADENCE)
  const [drawSun, setDrawSun] = useState<boolean>(true)

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
        const [root, files, outfile, times, committed, series] = await Promise.all([
          fetchDataRoot(),
          fetchDataFiles(),
          fetchOutputFile(),
          fetchFileTimes().catch((): FileTimeInfo[] => []),
          fetchCommittedTimes().catch((): string[] => []),
          fetchParamSeries().catch((): ParamSeriesRow[] => []),
        ])
        if (cancelled) return
        setDataRoot(root)
        setOutputFileState(outfile)
        setAvailableFiles(files)
        setFileTimes(times)
        setCommittedTimes(committed)
        setParamSeries(series)
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

  // When interpolation is on, snap the working params to the interpolated
  // committed series whenever a frame without its own commit loads.
  useEffect(() => {
    if (!interpOn || !selectedFile) return
    const entry = fileTimes.find((e) => e.name === selectedFile)
    let epoch: number | null = null
    if (entry?.time) {
      epoch = epochFromCsvTime(entry.time)
    }
    if (epoch === null) {
      epoch = epochFromFilename(selectedFile)
    }
    if (epoch === null || paramSeries.length === 0) return
    const committedEpochs = new Set<number>()
    for (const t of committedTimes) {
      const e = epochFromCsvTime(t)
      if (e !== null) committedEpochs.add(e)
    }
    if (committedEpochs.has(epoch)) return
    const next: Params = { ...params }
    for (const key of INTERP_KEYS) {
      const points = paramSeries.flatMap((row) => {
        const t = epochFromCsvTime(row.Time)
        return t === null || !Number.isFinite(row[key]) ? [] : [{ t, v: row[key] }]
      })
      const v = interpolateSeries(points, epoch, interpMethod)
      if (v === null || !Number.isFinite(v)) return
      next[key] = v
    }
    setParams(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interpOn, interpMethod, selectedFile, paramSeries, fileTimes, committedTimes])

  const refreshCommitState = async () => {
    try {
      const [committed, series] = await Promise.all([
        fetchCommittedTimes(),
        fetchParamSeries(),
      ])
      setCommittedTimes(committed)
      setParamSeries(series)
    } catch {
      // Commit state refresh is best-effort; values stay visible on next load.
    }
  }

  const refreshFileTimes = async () => {
    try {
      setFileTimes(await fetchFileTimes())
    } catch {
      // Keep showing the previous header state.
    }
  }

  const handlePickCsvFile = async (path: string) => {
    setCsvBrowserOpen(false)
    try {
      const updated = await setOutputFile(path)
      setOutputFileState(updated)
      await refreshCommitState()
    } catch {
      window.alert('Failed to use selected CSV file.')
    }
  }

  const handleCommit = async () => {
    if (!selectedFile) return
    try {
      await commitParams(params, selectedFile)
      await refreshCommitState()
    } catch {
      window.alert('Failed to commit parameters.')
    }
  }

  const handleUncommit = async () => {
    if (!selectedFile) return
    if (!window.confirm(`Remove the committed row for ${selectedFile}?`)) return
    try {
      await uncommit(selectedFile)
      await refreshCommitState()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error removing commit'
      window.alert(message)
    }
  }

  const handleAutoFit = async () => {
    if (!selectedFile || autoRunning) return
    setAutoRunning(true)
    try {
      const result = await autoFit(selectedFile)
      if (
        result.px0 === null ||
        result.py0 === null ||
        result.px1 === null ||
        result.py1 === null
      ) {
        window.alert(
          `Auto fit failed: only ${result.nUsed} channel(s) passed filters ` +
            `(need ${result.nRequired}). The interval may be flaring or too faint.`,
        )
        return
      }
      // Auto-fit fills the working params only; Commit to persist.
      setParams({ px0: result.px0, py0: result.py0, px1: result.px1, py1: result.py1 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error during auto fit'
      window.alert(message)
    } finally {
      setAutoRunning(false)
    }
  }

  const handleUpdateHeader = async () => {
    if (!selectedFile) return
    try {
      const { time } = await updateHeader(selectedFile)
      await refreshFileTimes()
      window.alert(`Header updated for ${time}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error updating header'
      window.alert(message)
    }
  }

  const handleUpdateAllHeaders = async () => {
    try {
      const { updated, skipped } = await updateAllHeaders()
      await refreshFileTimes()
      window.alert(
        `Updated ${updated.length} header(s)` +
          (skipped.length > 0 ? `, skipped ${skipped.length} (no CSV row).` : '.'),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error updating headers'
      window.alert(message)
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
      const [files, times] = await Promise.all([
        fetchDataFiles(),
        fetchFileTimes().catch((): FileTimeInfo[] => []),
      ])
      setAvailableFiles(files)
      setFileTimes(times)
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
        <div className="col-left">
          <ControlPadPanel
            params={params}
            onChangeParams={setParams}
            onCommit={handleCommit}
            onAuto={handleAutoFit}
            autoRunning={autoRunning}
            onUncommit={handleUncommit}
            selectedFile={selectedFile}
            hasPrevFile={hasPrevFile}
            hasNextFile={hasNextFile}
            onPrevFile={goPrevFile}
            onNextFile={goNextFile}
          />
          <div className="panel header-panel">
            <div className="panel-title">Headers</div>
            <div className="header-buttons">
              <button
                type="button"
                className="load-data-button"
                onClick={handleUpdateHeader}
                disabled={!selectedFile}
              >
                Update header
              </button>
              <button type="button" className="load-data-button" onClick={handleUpdateAllHeaders}>
                Update all headers
              </button>
            </div>
          </div>
          <SettingsPanel
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
        <div className="col-mid">
          <ContourPanel
            data={contourData}
            params={params}
            channelRange={channelRange}
            channelCadence={channelCadence}
            drawSun={drawSun}
          />
          <TimelinePanel
            fileTimes={fileTimes}
            selectedFile={selectedFile}
            committedTimes={committedTimes}
            onSelectFile={setSelectedFile}
          />
        </div>
        <div className="col-right">
          <FilePanel
            dataRoot={dataRoot}
            availableFiles={availableFiles}
            selectedFile={selectedFile}
            onChangeSelectedFile={setSelectedFile}
            onChangeDataRootValue={handleEditDataRootValue}
            onApplyDataRoot={handleApplyDataRoot}
            outputFile={outputFile}
            onSelectCsv={() => setCsvBrowserOpen(true)}
          />
          <ParamPlots
            series={paramSeries}
            fileTimes={fileTimes}
            selectedFile={selectedFile}
            current={params}
            interpOn={interpOn}
            onToggleInterp={setInterpOn}
            interpMethod={interpMethod}
            onMethodChange={setInterpMethod}
          />
        </div>
      </div>
      <CsvBrowser
        open={csvBrowserOpen}
        onClose={() => setCsvBrowserOpen(false)}
        onSelect={handlePickCsvFile}
      />
    </div>
  )
}

export default App

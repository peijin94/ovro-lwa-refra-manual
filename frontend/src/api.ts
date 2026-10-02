import type {
  DataFileList,
  DataRootInfo,
  LoadParamsResponse,
  MultiChannelData,
  OutputFileInfo,
  Params,
} from './types'

const BASE_URL = '/api'

export async function fetchMultiChannelData(
  filename: string,
  contourValue: number,
  valuePowerIndex: number,
): Promise<MultiChannelData> {
  const params = new URLSearchParams({
    filename,
    contour_value: String(contourValue),
    value_power_index: String(valuePowerIndex),
  })
  const response = await fetch(`${BASE_URL}/contours?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to load contour data: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as MultiChannelData
  return json
}

export async function fetchDataFiles(): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/files`)
  if (!response.ok) {
    throw new Error(`Failed to load file list: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as DataFileList
  return json.files
}

export async function fetchCommittedTimes(): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/committed-times`)
  if (!response.ok) {
    throw new Error(`Failed to load committed times: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as { times: string[] }
  return json.times
}

export type HeaderParams = { px0: number | null; py0: number | null; px1: number | null; py1: number | null }

export type FileTimeInfo = { name: string; time: string | null; params: HeaderParams }

export async function fetchFileTimes(): Promise<FileTimeInfo[]> {
  const response = await fetch(`${BASE_URL}/file-times`)
  if (!response.ok) {
    throw new Error(`Failed to load file times: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as { files: FileTimeInfo[] }
  return json.files
}

export type ParamSeriesRow = {
  Time: string
  px0: number
  px1: number
  py0: number
  py1: number
}

export async function fetchParamSeries(): Promise<ParamSeriesRow[]> {
  const response = await fetch(`${BASE_URL}/param-series`)
  if (!response.ok) {
    throw new Error(`Failed to load param series: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as { rows: ParamSeriesRow[] }
  return json.rows
}

async function apiErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const json = (await response.json()) as { detail?: string }
    return json.detail || `${fallback}: ${response.status} ${response.statusText}`
  } catch {
    return `${fallback}: ${response.status} ${response.statusText}`
  }
}

export async function updateHeader(filename: string): Promise<{ time: string }> {
  const response = await fetch(`${BASE_URL}/update-header`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  })
  if (!response.ok) {
    throw new Error(await apiErrorDetail(response, 'Failed to update header'))
  }
  return (await response.json()) as { time: string }
}

export async function updateAllHeaders(): Promise<{ updated: string[]; skipped: string[] }> {
  const response = await fetch(`${BASE_URL}/update-all-headers`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(await apiErrorDetail(response, 'Failed to update headers'))
  }
  return (await response.json()) as { updated: string[]; skipped: string[] }
}

export type BrowseResult = {
  cwd: string
  parent: string | null
  dirs: string[]
  csvs: string[]
}

export async function browseDirectory(path?: string): Promise<BrowseResult> {
  const qs = path ? `?path=${encodeURIComponent(path)}` : ''
  const response = await fetch(`${BASE_URL}/browse${qs}`)
  if (!response.ok) {
    throw new Error(await apiErrorDetail(response, 'Failed to browse directory'))
  }
  return (await response.json()) as BrowseResult
}

export type AutoFitResult = {
  px0: number | null
  py0: number | null
  px1: number | null
  py1: number | null
  nUsed: number
  nRequired: number
}

export async function autoFit(filename: string): Promise<AutoFitResult> {
  const response = await fetch(`${BASE_URL}/auto-fit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  })
  if (!response.ok) {
    throw new Error(await apiErrorDetail(response, 'Auto fit failed'))
  }
  return (await response.json()) as AutoFitResult
}

export async function uncommit(filename: string): Promise<{ time: string }> {
  const response = await fetch(`${BASE_URL}/uncommit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  })
  if (!response.ok) {
    throw new Error(await apiErrorDetail(response, 'Failed to un-commit'))
  }
  return (await response.json()) as { time: string }
}

export async function fetchDataRoot(): Promise<string> {
  const response = await fetch(`${BASE_URL}/data-root`)
  if (!response.ok) {
    throw new Error(`Failed to load data root: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as DataRootInfo
  return json.dataRoot
}

export async function setDataRoot(path: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/data-root`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!response.ok) {
    let detail = ''
    try {
      const json = (await response.json()) as { detail?: string }
      detail = json.detail ?? ''
    } catch {
      // ignore JSON parse errors; fall back to status text
    }
    const msg = detail || `Failed to update data root: ${response.status} ${response.statusText}`
    throw new Error(msg)
  }
  const json = (await response.json()) as DataRootInfo
  return json.dataRoot
}

export async function fetchOutputFile(): Promise<string> {
  const response = await fetch(`${BASE_URL}/output-file`)
  if (!response.ok) {
    throw new Error(`Failed to load output file: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as OutputFileInfo
  return json.outputFile
}

export async function setOutputFile(path: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/output-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!response.ok) {
    throw new Error(`Failed to update output file: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as OutputFileInfo
  return json.outputFile
}

export async function commitParams(params: Params, filename: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/commit-params`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, ...params }),
  })
  if (!response.ok) {
    throw new Error(`Failed to commit parameters: ${response.status} ${response.statusText}`)
  }
}

export async function loadParamsForFile(filename: string): Promise<Params | null> {
  const response = await fetch(`${BASE_URL}/load-params`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filename }),
  })
  if (!response.ok) {
    throw new Error(`Failed to load parameters: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as LoadParamsResponse
  if (!json.found) return null
  return {
    px0: json.px0,
    py0: json.py0,
    px1: json.px1,
    py1: json.py1,
  }
}

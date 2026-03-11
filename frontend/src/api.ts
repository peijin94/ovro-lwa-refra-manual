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

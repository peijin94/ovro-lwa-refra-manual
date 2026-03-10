import type { DataFileList, MultiChannelData } from './types'

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



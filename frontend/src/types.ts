export type ChannelMeta = {
  id: string
  index: number
  /** Channel center frequency in Hz */
  freqHz: number
}

export type ChannelContourPoint = {
  x: number
  y: number
}

export type ChannelContour = {
  channelId: string
  /** Contour level in whatever units the backend uses (e.g. Jy/beam) */
  level: number
  points: ChannelContourPoint[]
}

export type SpatialExtent = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export type MultiChannelData = {
  channels: ChannelMeta[]
  contours: ChannelContour[]
  spatialExtent: SpatialExtent
}

export type Params = {
  px0: number
  py0: number
  px1: number
  py1: number
}

export type ChannelRange = {
  start: number
  end: number
}

export type DataFileList = {
  files: string[]
}

export type DataRootInfo = {
  dataRoot: string
}

export type OutputFileInfo = {
  outputFile: string
}

export type LoadParamsResponse =
  | { found: false }
  | {
      found: true
      px0: number
      py0: number
      px1: number
      py1: number
    }





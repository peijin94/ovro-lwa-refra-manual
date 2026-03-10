# Contour data API contract

The frontend expects a JSON API exposed by the Python backend that provides
multi-channel contour data derived from FITS/HDF5 inputs.

## Endpoint

- `GET /api/contours`

The endpoint should return a JSON body of the form:

```json
{
  "channels": [
    {
      "id": "ch0001",
      "index": 0,
      "freqHz": 5.0e7
    }
  ],
  "contours": [
    {
      "channelId": "ch0001",
      "level": 1,
      "points": [
        { "x": -10.5, "y": -3.2 },
        { "x": -10.1, "y": -3.0 }
      ]
    }
  ],
  "spatialExtent": {
    "xMin": -20.0,
    "xMax": 20.0,
    "yMin": -20.0,
    "yMax": 20.0
  }
}
```

### Field definitions

- `channels`: one entry per channel
  - `id`: unique channel identifier string (referenced by `channelId`).
  - `index`: integer index (0-based) in frequency order.
  - `freqHz`: channel center frequency in Hz (typically 20–80 × 10^6).
- `contours`: list of contour polygons
  - `channelId`: channel `id` this contour belongs to.
  - `level`: contour level index or value. The UI currently uses a single
    `contourLevel` value (default `1`) and filters by exact equality.
  - `points`: array of `{x, y}` vertices in **physical coordinates**, derived
    from FITS header information (e.g. CRVAL/CDELT, or project-specific keys).
- `spatialExtent`: global x/y range before offsets
  - `xMin`, `xMax`, `yMin`, `yMax`: extrema of all contour coordinates,
    useful for sanity checks and potential future auto-scaling.

## Frequency-dependent offsets

On the frontend, each point `(x, y)` in `points` is shifted per channel
according to:

- `x_offset = px0 * (1 / freqHz^2) + px1`
- `y_offset = py0 * (1 / freqHz^2) + py1`

The app then renders contours using `(x + x_offset, y + y_offset)`. The P0
joystick controls `px0` and `py0` (large range ~[-2e19, 2e19]) and the P1
joystick controls `px1` and `py1` (range ~[-1500, 1500]).


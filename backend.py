from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Tuple
import traceback

import h5py
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from skimage import measure
import uvicorn

from util import recover_fits_from_h5


DATA_DIR = Path(__file__).parent / "data"
FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

app = FastAPI(title="Contour Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_image_cube_from_hdf5(hdf5_path: Path) -> Tuple[np.ndarray, np.ndarray, np.ndarray | None, np.ndarray | None]:
  """
  Load a (channel, y, x) image cube and per-channel frequencies using the
  existing recover_fits_from_h5 helper from util.py.

  Returns (freqs_hz, data, x_coords, y_coords) where:
    - data has shape (channel, y, x)
    - x_coords, y_coords are 1D coordinate arrays for the image axes in
      physical units (e.g. arcsec) if available, otherwise None.
  """
  meta, data = recover_fits_from_h5(str(hdf5_path), return_data=True)  # type: ignore[misc]

  # recover_fits_from_h5 returns data with shape (pol, channel, y, x)
  if data.ndim != 4:
    raise ValueError(f"Expected recovered data with 4 dims (pol, ch, y, x), got shape {data.shape}")

  # Use first polarization for now
  cube = np.asarray(data[0], dtype=float)  # (channel, y, x)

  # Frequencies are provided in the metadata produced by recover_fits_from_h5
  if "cfreqs" in meta:
    freqs_hz = np.asarray(meta["cfreqs"], dtype=float).reshape(-1)
  else:
    # Fallback: evenly spaced 20–80 MHz
    n_ch = cube.shape[0]
    freqs_hz = np.linspace(20e6, 80e6, n_ch)

  # Try to derive physical x/y coordinate axes.
  ny, nx = cube.shape[1], cube.shape[2]
  x_coords: np.ndarray | None = None
  y_coords: np.ndarray | None = None

  # 1) Prefer WCS-style information in the FITS header (single set of
  #    parameters shared by all channels).
  header = meta.get("header")
  if header is not None:
    cdelt1 = header.get("CDELT1")
    cdelt2 = header.get("CDELT2")
    crval1 = header.get("CRVAL1")
    crval2 = header.get("CRVAL2")
    crpix1 = header.get("CRPIX1")
    crpix2 = header.get("CRPIX2")
    if None not in (cdelt1, cdelt2, crval1, crval2, crpix1, crpix2):
      # FITS uses 1-based pixel coordinates. Here CDELT/CRVAL are already in
      # arcsec, so we do not apply any extra scaling.
      i = np.arange(nx, dtype=float) + 1.0
      j = np.arange(ny, dtype=float) + 1.0
      x_coords = (i - crpix1) * cdelt1 + crval1
      y_coords = (j - crpix2) * cdelt2 + crval2

  # 2) If no WCS, fall back to searching for 1D arrays in meta whose length
  #    matches the image axes.
  if x_coords is None or y_coords is None:
    for key, value in meta.items():
      if key == "header":
        continue
      arr = np.asarray(value)
      if arr.ndim != 1:
        continue
      if arr.shape[0] == nx and x_coords is None:
        x_coords = arr.astype(float)
      elif arr.shape[0] == ny and y_coords is None:
        y_coords = arr.astype(float)

  return freqs_hz, cube, x_coords, y_coords


def _build_multi_channel_contours(
    freqs_hz: np.ndarray,
    data: np.ndarray,
    x_coords: np.ndarray | None,
    y_coords: np.ndarray | None,
    base_contour_value: float,
    value_power_index: float,
    max_channels: int | None = None,
) -> Dict[str, Any]:
  """
  Build the MultiChannelData dict expected by the frontend.
  """
  # data shape: (channel, y, x)
  if data.ndim != 3:
    raise ValueError(f"Expected data with 3 dims (ch, y, x), got shape {data.shape}")

  n_ch, ny, nx = data.shape

  freqs_arr = np.asarray(freqs_hz, dtype=float).reshape(-1)

  n_use = n_ch if max_channels is None else min(n_ch, max_channels)

  # Reference frequency for scaling contour value.
  freq0 = float(freqs_arr[0]) if freqs_arr.size > 0 else 1.0

  channels: List[Dict[str, Any]] = []
  contours: List[Dict[str, Any]] = []

  for ch_idx in range(n_use):
    chan_id = f"ch{ch_idx:04d}"
    channels.append(
      {
        "id": chan_id,
        "index": ch_idx,
        "freqHz": float(freqs_arr[ch_idx]),
      }
    )

    image = data[ch_idx, :, :]

    # skimage.measure.find_contours uses (row, col) ~= (y, x)
    # Per-channel contour level:
    #   level(f) = base_contour_value * (f / freq0) ** R
    freq_hz = float(freqs_arr[ch_idx])
    if freq0 != 0.0:
      local_level = base_contour_value * (freq_hz / freq0) ** value_power_index
    else:
      local_level = base_contour_value

    paths = measure.find_contours(image, level=local_level)

    for path in paths:
      # path: (N, 2) of (y, x) in pixel indices
      y_pix = path[:, 0]
      x_pix = path[:, 1]

      # Map pixel coordinates into physical coordinates if available from
      # the metadata; otherwise use pixel indices directly.
      if x_coords is not None:
        x_vals = np.interp(x_pix, np.arange(nx, dtype=float), x_coords)
      else:
        x_vals = x_pix
      if y_coords is not None:
        y_vals = np.interp(y_pix, np.arange(ny, dtype=float), y_coords)
      else:
        y_vals = y_pix

      points = [{"x": float(xv), "y": float(yv)} for xv, yv in zip(x_vals, y_vals)]

      contours.append(
        {
          "channelId": chan_id,
          "level": float(local_level),
          "points": points,
        }
      )

  all_x = [p["x"] for c in contours for p in c["points"]]
  all_y = [p["y"] for c in contours for p in c["points"]]

  if all_x and all_y:
    spatial_extent = {
      "xMin": float(min(all_x)),
      "xMax": float(max(all_x)),
      "yMin": float(min(all_y)),
      "yMax": float(max(all_y)),
    }
  else:
    spatial_extent = {"xMin": 0.0, "xMax": 0.0, "yMin": 0.0, "yMax": 0.0}

  return {
    "channels": channels,
    "contours": contours,
    "spatialExtent": spatial_extent,
  }


@app.get("/api/files")
def list_hdf_files() -> Dict[str, Any]:
  """
  List available HDF5/HDF image cubes under the data/ directory.
  """
  if not DATA_DIR.is_dir():
    return {"files": []}

  exts = {".hdf", ".hdf5", ".h5"}
  files = sorted(p.name for p in DATA_DIR.iterdir() if p.is_file() and p.suffix in exts)
  return {"files": files}


if FRONTEND_DIST.is_dir():
  # Serve built frontend assets (Vite `npm run build`) at `/`.
  app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIST / "assets"),
    name="assets",
  )


  @app.get("/", include_in_schema=False)
  def index() -> FileResponse:
    """Serve the SPA index.html at the root path."""
    return FileResponse(FRONTEND_DIST / "index.html")


@app.get("/api/contours")
def get_contours(
    filename: str = Query(..., description="HDF5 file name under the data/ directory"),
    contour_value: float = Query(1e6, description="Base contour value at reference frequency"),
    value_power_index: float = Query(0.0, description="Power index R in (freq/freq0)**R"),
    max_channels: int | None = Query(
      128,
      ge=1,
      description="Maximum number of channels to include (starting from 0)",
    ),
) -> Dict[str, Any]:
  """
  Generate multi-channel contour data from an HDF5-compressed observation.

  The frontend expects the JSON structure documented in `frontend/CONTOUR_API.md`.
  """
  hdf5_path = DATA_DIR / filename
  if not hdf5_path.is_file():
    raise HTTPException(status_code=404, detail=f"HDF5 file not found: {hdf5_path}")

  try:
    freqs_hz, data, x_coords, y_coords = _load_image_cube_from_hdf5(hdf5_path)
    payload = _build_multi_channel_contours(
      freqs_hz,
      data,
      x_coords,
      y_coords,
      base_contour_value=contour_value,
      value_power_index=value_power_index,
      max_channels=max_channels,
    )
  except Exception as exc:  # pragma: no cover - error path
    # Log full traceback to help with debugging in development.
    traceback.print_exc()
    raise HTTPException(status_code=500, detail=str(exc)) from exc

  return payload


if __name__ == "__main__":
  port = int(os.getenv("PORT", "8987"))
  uvicorn.run("backend:app", host="127.0.0.1", port=port, reload=True)


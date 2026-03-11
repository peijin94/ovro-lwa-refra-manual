from __future__ import annotations

import os
import csv
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple
from datetime import datetime, timezone
import traceback

import h5py
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from skimage import measure
import uvicorn

from pydantic import BaseModel

from util import recover_fits_from_h5


DATA_DIR = Path(__file__).parent / "data"
FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"
DEFAULT_OUTFILE = Path(os.getenv("OUTFILE", "manual_corr.csv"))
OUTFILE_PATH: Path = DEFAULT_OUTFILE

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


class OutputFileRequest(BaseModel):
  path: str


class CommitParamsRequest(BaseModel):
  filename: str
  px0: float
  py0: float
  px1: float
  py1: float


class DataRootRequest(BaseModel):
  path: str


def _resolve_outfile(path: Path) -> Path:
  path = path.expanduser()
  if not path.is_absolute():
    path = Path.cwd() / path
  path.parent.mkdir(parents=True, exist_ok=True)
  return path


def _timestamp_from_filename(filename: str) -> str:
  """
  Extract a UTC timestamp from the data filename (no trailing Z), falling back to "now" in UTC.

  Expected pattern (from filenames such as
  ovro-lwa-352.lev1_fch_10s.2024-11-21T183806Z.image_I.hdf):

    YYYY-MM-DDTHHMMSSZ
  """
  m = re.search(r"(\d{4}-\d{2}-\d{2}T\d{6}Z)", filename)
  if m:
    token = m.group(1)
    try:
      dt = datetime.strptime(token, "%Y-%m-%dT%H%M%SZ").replace(tzinfo=timezone.utc)
      return dt.strftime("%Y-%m-%dT%H:%M:%S")
    except ValueError:
      pass

  # Fallback: current UTC time (no Z)
  dt_now = datetime.now(timezone.utc)
  return dt_now.strftime("%Y-%m-%dT%H:%M:%S")


def _normalize_time(t: str) -> str:
  """Normalize time string for comparison (strip and remove trailing Z)."""
  return (t or "").strip().rstrip("Z")


def _commit_params_record(timestamp: str, px0: float, py0: float, px1: float, py1: float) -> None:
  """
  Write or update a parameter record in the CSV outfile.
  Time is stored without trailing Z. If a row with the same Time exists, it is updated in place.
  """
  global OUTFILE_PATH
  outfile = _resolve_outfile(OUTFILE_PATH)
  fieldnames = ["Time", "px0", "px1", "py0", "py1"]
  new_row = {
    "Time": timestamp,
    "px0": f"{px0:.16e}",
    "px1": f"{px1:.16e}",
    "py0": f"{py0:.16e}",
    "py1": f"{py1:.16e}",
  }
  target_norm = _normalize_time(timestamp)

  if not outfile.exists():
    with outfile.open("w", newline="") as f:
      writer = csv.DictWriter(f, fieldnames=fieldnames)
      writer.writeheader()
      writer.writerow(new_row)
    OUTFILE_PATH = outfile
    return

  rows: List[Dict[str, str]] = []
  updated = False
  with outfile.open("r", newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
      if _normalize_time(row.get("Time", "")) == target_norm:
        if not updated:
          rows.append(new_row)
          updated = True
        # skip duplicate rows with same time
      else:
        rows.append(row)

  if not updated:
    rows.append(new_row)

  with outfile.open("w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

  OUTFILE_PATH = outfile


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


@app.get("/api/data-root")
def get_data_root() -> Dict[str, Any]:
  """
  Return the current server-side data directory used to search for HDF files.
  """
  return {"dataRoot": str(DATA_DIR)}


@app.post("/api/data-root")
def set_data_root(req: DataRootRequest) -> Dict[str, Any]:
  """
  Update the server-side data directory used to search for HDF files.
  """
  global DATA_DIR
  new_root = Path(req.path).expanduser()
  if not new_root.is_dir():
    raise HTTPException(status_code=400, detail=f"Data directory does not exist: {new_root}")
  DATA_DIR = new_root
  return {"dataRoot": str(DATA_DIR)}


@app.get("/api/output-file")
def get_output_file() -> Dict[str, Any]:
  """
  Return the current CSV outfile path used for manual corrections.
  """
  global OUTFILE_PATH
  outfile = _resolve_outfile(OUTFILE_PATH)
  return {"outputFile": str(outfile)}


@app.post("/api/output-file")
def set_output_file(req: OutputFileRequest) -> Dict[str, Any]:
  """
  Update the CSV outfile path used for manual corrections.
  """
  global OUTFILE_PATH
  new_path = _resolve_outfile(Path(req.path))
  OUTFILE_PATH = new_path
  return {"outputFile": str(OUTFILE_PATH)}


@app.post("/api/load-params")
def load_params(req: OutputFileRequest) -> Dict[str, Any]:
  """
  Look up previously committed parameters for a given filename timestamp.

  Returns:
    { "found": false } if no matching record exists, otherwise
    {
      "found": true,
      "px0": float,
      "py0": float,
      "px1": float,
      "py1": float,
    }
  """
  outfile = _resolve_outfile(OUTFILE_PATH)
  if not outfile.exists():
    return {"found": False}

  target_ts = _timestamp_from_filename(req.path)
  target_norm = _normalize_time(target_ts)

  latest_match: Dict[str, float] | None = None
  with outfile.open("r", newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
      if _normalize_time(row.get("Time", "")) == target_norm:
        try:
          latest_match = {
            "px0": float(row["px0"]),
            "py0": float(row["py0"]),
            "px1": float(row["px1"]),
            "py1": float(row["py1"]),
          }
        except (KeyError, ValueError):
          continue

  if latest_match is None:
    return {"found": False}

  return {"found": True, **latest_match}


@app.post("/api/commit-params")
def commit_params(req: CommitParamsRequest) -> Dict[str, Any]:
  """
  Append the current parameter set to the CSV outfile.
  """
  try:
    timestamp = _timestamp_from_filename(req.filename)
    _commit_params_record(timestamp, req.px0, req.py0, req.px1, req.py1)
  except Exception as exc:  # pragma: no cover - error path
    traceback.print_exc()
    raise HTTPException(status_code=500, detail=str(exc)) from exc

  return {"ok": True, "outputFile": str(OUTFILE_PATH)}


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
  port = int(os.getenv("PORT", "8989"))
  uvicorn.run("backend:app", host="127.0.0.1", port=port, reload=True)


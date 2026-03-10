import argparse
from pathlib import Path

import numpy as np

import sys, os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import _load_image_cube_from_hdf5, DATA_DIR

def main() -> int:
    parser = argparse.ArgumentParser(description="Print freqs_arr (channel center frequencies) from an HDF5 file.")
    parser.add_argument(
        "filename",
        help="HDF5 file name (relative to the data/ directory, e.g. ovro-lwa-*.hdf)",
    )
    args = parser.parse_args()

    hdf5_path = DATA_DIR / args.filename
    if not hdf5_path.is_file():
        raise SystemExit(f"HDF5 file not found: {hdf5_path}")

    freqs_hz, cube, x_coords, y_coords = _load_image_cube_from_hdf5(hdf5_path)
    freqs_arr = np.asarray(freqs_hz, dtype=float).reshape(-1)

    print(f"File: {hdf5_path}")
    print(f"Data cube shape (ch, y, x): {cube.shape}")
    print("freqs_arr (Hz):")
    for i, f in enumerate(freqs_arr):
        print(f"  ch {i:4d}: {f:.6e} Hz")

    if x_coords is not None:
        print(f"x_coords span: {x_coords[0]:.3e} .. {x_coords[-1]:.3e} (len={x_coords.size})")
    else:
        print("x_coords: None (no matching 1D axis found in meta)")

    if y_coords is not None:
        print(f"y_coords span: {y_coords[0]:.3e} .. {y_coords[-1]:.3e} (len={y_coords.size})")
    else:
        print("y_coords: None (no matching 1D axis found in meta)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


import argparse
import sys
from pathlib import Path

import h5py

from util import recover_fits_from_h5


def test_file(path: Path) -> None:
    """Attempt to decode a single HDF5 file using recover_fits_from_h5."""
    print(f"=== Testing {path} ===")

    # First, try reading basic ch_vals attrs directly to see if h5py can handle them.
    try:
        with h5py.File(path, "r") as f:
            ch_vals = f["ch_vals"]
            print("  ch_vals dtype:", ch_vals.dtype)
            print("  ch_vals.attrs keys:", list(ch_vals.attrs.keys()))
    except Exception as exc:
        print("  Error reading ch_vals/attrs:", repr(exc))

    # Then, exercise the higher-level helper.
    try:
        meta, data = recover_fits_from_h5(str(path), return_data=True)
        header = meta.get("header")
        print("  recover_fits_from_h5: OK")
        if header is not None:
            print("  header keys:", list(header.keys())[:10], "...")
        print("  data shape:", getattr(data, "shape", None))
    except Exception as exc:  # pragma: no cover - debug helper
        print("  recover_fits_from_h5 FAILED:", repr(exc))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Quick HDF5 sanity checks for ovro-lwa-refra-manual.")
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="HDF5 files to test (defaults to all *.hdf* in ./data)",
    )
    args = parser.parse_args(argv)

    files: list[Path]
    if args.paths:
        files = [p for p in args.paths if p.is_file()]
    else:
        data_dir = Path(__file__).resolve().parent.parent / "data"
        exts = {".hdf", ".hdf5", ".h5"}
        files = sorted(p for p in data_dir.iterdir() if p.is_file() and p.suffix in exts)

    if not files:
        print("No HDF5 files found to test.")
        return 0

    for fpath in files:
        test_file(fpath)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


"""Automatic refraction fit (px0/py0/px1/py1) for OVRO-LWA image cubes.

Algorithm ported from lwa-solar-util ``refraction_corr.py`` (ovro-eovsa,
``refraction_fit_param``): per-channel quiet-Sun center-of-mass versus
1/frequency^2, then a linear polyfit::

    x = px0 / f^2 + px1
    y = py0 / f^2 + py1

Adapted to the ``(meta, data)`` pair produced by
``util.recover_fits_from_h5`` (``meta["cfreqs"]`` instead of ``ref_cfreqs``).
"""

from __future__ import annotations

import warnings
from typing import Any, Dict

import numpy as np
from scipy.ndimage import binary_dilation, binary_erosion, center_of_mass
from skimage.morphology import convex_hull_image, remove_small_objects


def thresh_func(freq):
    """Return brightness threshold (Tb) for frequency ``freq`` in Hz."""
    return 1.1e6 * (1 - 1.8e4 * freq ** (-0.6))


def find_quite_sun_region(data, thresh, min_size, convex_hull=False):
    threshed_img = data > thresh
    threshed_img_1st = remove_small_objects(
        threshed_img, min_size=min_size, connectivity=1
    )
    threshed_img_2nd = binary_erosion(threshed_img_1st, iterations=3)
    threshed_img_3rd = remove_small_objects(
        threshed_img_2nd, min_size=min_size, connectivity=1
    )
    threshed_img_4th = binary_dilation(threshed_img_3rd, iterations=3)
    if convex_hull:
        threshed_img_4th = convex_hull_image(threshed_img_4th)
    return threshed_img_4th


def find_center_of_thresh(
    data_this, thresh, meta, index, min_size_50=1000, convex_hull=False
):
    """
    Find the center of the thresholded image.

    ``min_size_50`` is the smallest allowable object area in pixels at 50 MHz;
    ``min_size`` scales with ``1/(nu[MHz]/50 MHz)**2``.
    """
    meta_header = meta["header"]
    min_size = int(
        min_size_50
        / (meta_header["CDELT1"] / 60.0) ** 2.0
        / (meta["cfreqs"][index] / 50e6) ** 2.0
    )
    threshed_img_4th = find_quite_sun_region(
        data_this, thresh, min_size, convex_hull=convex_hull
    )

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        com = center_of_mass(threshed_img_4th)

    x_arr = meta_header["CRVAL1"] + meta_header["CDELT1"] * (
        np.arange(meta_header["NAXIS1"]) - (meta_header["CRPIX1"] - 1)
    )
    y_arr = meta_header["CRVAL2"] + meta_header["CDELT2"] * (
        np.arange(meta_header["NAXIS2"]) - (meta_header["CRPIX2"] - 1)
    )

    com_x_arcsec = x_arr[0] + com[1] * (x_arr[-1] - x_arr[0]) / (len(x_arr) - 1)
    com_y_arcsec = y_arr[0] + com[0] * (y_arr[-1] - y_arr[0]) / (len(y_arr) - 1)

    return [com_x_arcsec, com_y_arcsec]


def refraction_fit_param(
    fname=None,
    thresh_freq=45e6,
    overbright=2.0e6,
    min_freqfrac=0.3,
    convex_hull=False,
    background_factor=1 / 8,
    data=None,
    meta=None,
) -> Dict[str, Any]:
    """
    Fit refraction parameters for a multi-frequency image cube.

    Returns a record ``{"Time", "px0", "px1", "py0", "py1", "n_used",
    "n_required"}``. The px/py values are NaN when too few channels pass
    the filters (channels above ``thresh_freq`` whose peak is below
    ``overbright`` and whose thresholded center-of-mass is finite).
    """
    if overbright is None:
        overbright = np.inf

    if data is None or meta is None:
        raise ValueError("refraction_fit_param requires data and meta arrays.")

    freqs_arr = np.asarray(meta["cfreqs"], dtype=float).reshape(-1)

    com_x_arr = []
    com_y_arr = []
    peak_values_tmp = []
    for idx_img in range(freqs_arr.shape[0]):
        thresh = thresh_func(freqs_arr[idx_img]) * background_factor
        data_this = np.squeeze(np.asarray(data[0, idx_img, :, :], dtype=float))
        com_x_arcsec, com_y_arcsec = find_center_of_thresh(
            data_this, thresh, meta, idx_img, convex_hull=convex_hull
        )
        peak_values_tmp.append(np.nanmax(data_this))
        com_x_arr.append(com_x_arcsec)
        com_y_arr.append(com_y_arcsec)

    com_x_tmp = np.array(com_x_arr)
    com_y_tmp = np.array(com_y_arr)
    peak_values_tmp = np.array(peak_values_tmp)

    idx_for_gt_freqthresh = np.where(freqs_arr > thresh_freq)

    freq_for_fit = freqs_arr[idx_for_gt_freqthresh]
    com_x_for_fit = com_x_tmp[idx_for_gt_freqthresh]
    com_y_for_fit = com_y_tmp[idx_for_gt_freqthresh]
    peak_values_for_fit = peak_values_tmp[idx_for_gt_freqthresh]

    idx_not_too_bright = np.where(peak_values_for_fit < overbright)
    freq_for_fit_v1 = freq_for_fit[idx_not_too_bright]
    com_x_for_fit_v1 = com_x_for_fit[idx_not_too_bright]
    com_y_for_fit_v1 = com_y_for_fit[idx_not_too_bright]

    idx_nan = np.where(np.isnan(com_x_for_fit_v1) | np.isnan(com_y_for_fit_v1))
    freq_for_fit_v2 = np.delete(freq_for_fit_v1, idx_nan)
    com_x_for_fit_v2 = np.delete(com_x_for_fit_v1, idx_nan)
    com_y_for_fit_v2 = np.delete(com_y_for_fit_v1, idx_nan)

    n_above = len(idx_for_gt_freqthresh[0])
    min_points = max(int(n_above * min_freqfrac), 3)
    if n_above >= 20:
        min_points = max(min_points, 5)

    if freq_for_fit_v2.size >= min_points:
        px = np.polyfit(1 / freq_for_fit_v2 ** 2, com_x_for_fit_v2, 1)
        py = np.polyfit(1 / freq_for_fit_v2 ** 2, com_y_for_fit_v2, 1)
    else:
        px = [np.nan, np.nan]
        py = [np.nan, np.nan]

    header = meta.get("header") or {}
    try:
        reftime = str(header.get("DATE-OBS", ""))[:19]
    except Exception:
        reftime = ""

    return {
        "Time": reftime,
        "px0": float(px[0]),
        "px1": float(px[1]),
        "py0": float(py[0]),
        "py1": float(py[1]),
        "n_used": int(freq_for_fit_v2.size),
        "n_required": int(min_points),
    }

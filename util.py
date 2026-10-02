import os

import numpy as np
from astropy.io import fits


def recover_fits_from_h5(hdf5_file, fits_out=None, return_data=False, return_meta_only=False):
    """
    Recover a fits file from a compressed hdf5 file

    :param hdf5_file: path to the HDF5 file to read.
    :param fits_out: optional path to write the recovered FITS file. If not
        given and return_data is False, defaults to '{filename}.fits' beside
        the HDF5 file.
    :param return_data: if True, return the metadata and recovered data array
        instead of writing a FITS file.
    :param return_meta_only: if True, return only the metadata (no data or
        FITS file is created).
    """
    import h5py
    from scipy.ndimage import zoom

    if fits_out is None and not return_data:
        fits_out = './' + os.path.basename(hdf5_file).replace('.hdf', '.fits')

    with h5py.File(hdf5_file, 'r') as f:
        header_dict = dict(f['ch_vals'].attrs)
        datashape = header_dict['original_shape']
        header_dict.pop('arr_name', None)
        header_dict.pop('original_shape', None)
        header = fits.Header(header_dict)

        ch_vals = {name: f['ch_vals'][i] for i, name in enumerate(f['ch_vals'].attrs['arr_name'])}
        attaching_columns = [fits.Column(name=key, format='E', array=ch_vals[key]) for key in ch_vals]
        meta = {'header': header, **{col.name: col.array for col in attaching_columns}}
        if return_meta_only:
            return meta

        # Read in the compressed data
        expected_shape = (int(datashape[-2]), int(datashape[-1]))
        recover_data = np.zeros(datashape)
        for pol in range(datashape[0]):
            for ch_idx, freq in enumerate(meta['cfreqs']):
                tmp_small = f[f'FITS_pol{pol}ch{str(ch_idx).rjust(4, "0")}'][:]
                if tmp_small.shape[0] == 1:
                    img = tmp_small[0, 0]
                else:
                    img = zoom(
                        tmp_small,
                        datashape[-1] / tmp_small.shape[-1],
                        order=3,
                        prefilter=False,
                    )
                if tuple(img.shape) != expected_shape:
                    raise ValueError(
                        f"{hdf5_file} pol{pol} ch{ch_idx}: decoded image has shape "
                        f"{tuple(img.shape)}, expected {expected_shape}"
                    )
                recover_data[pol, ch_idx, :, :] = img

        if return_data:
            return meta, recover_data

        # Write out the recovered FITS file
        hdu_list = fits.HDUList(
            [fits.PrimaryHDU(recover_data, header), fits.BinTableHDU.from_columns(attaching_columns)]
        )
        hdu_list.writeto(fits_out, overwrite=True)

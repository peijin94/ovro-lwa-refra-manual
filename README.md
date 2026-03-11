# OVRO-LWA Refraction Manual Correction Tool

Web app for interactively fitting **px0, py0, px1, py1** so that multi-frequency contour plots align across channels. The parameters define a per-channel spatial offset used in refraction correction:

- **x_offset** = px0 / f² + px1  
- **y_offset** = py0 / f² + py1  

where *f* is channel frequency. Results are written to a CSV (e.g. `manual_corr.csv`) keyed by observation time (UTC from the data filename).


---
<img width="1758" height="1048" alt="image" src="https://github.com/user-attachments/assets/5b9fc3d5-19ff-4ff6-8d6a-4b4040234cdc" />

---

## Setup

1. **Clone the repo**

   ```bash
   git clone <this-repo-url>
   cd ovro-lwa-refra-manual
   ```

2. **Backend (Python)**

   Create and activate a virtual environment (recommended), then install Python dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

   Start the backend:

   ```bash
   python backend.py
   ```

   Backend runs at `http://127.0.0.1:8989` by default. Set `PORT` if needed.

3. **Frontend (no npm required for normal use)**

   For typical use you only need the Python backend. Once `python backend.py` is running, open a browser at:

   ```text
   http://127.0.0.1:8989
   ```

   The backend will serve the bundled frontend UI if a built `frontend/dist` directory is present (this is how binary/source releases of this tool should be packaged). You do **not** need `npm` or Node.js just to run the tool.

   If you are developing the UI from source and **do** have `npm`, see `frontend/README.md` for the Vite dev workflow (`npm install`, `npm run dev`, etc.).

4. **Data**  
   Put HDF5 image cubes in the `data/` directory (or point the app to another directory via **Load Data**). Filenames should contain a UTC timestamp like `2024-11-21T183806Z` so the tool can match commits to files.

---

## User Guide: How to Get px0, py0, px1, py1

### What you’re doing

You are choosing four numbers (**px0, py0, px1, py1**) so that when each channel’s contours are shifted by:

- **x_offset** = px0 / f² + px1  
- **y_offset** = py0 / f² + py1  

the contours line up across frequency. The left panel shows the current contours with these offsets applied; you adjust P0 and P1 until the alignment looks good, then **Commit** to save that row to the CSV.

### Layout

- **Contour** (left): Multi-channel contours with the current px0, py0, px1, py1 applied. A dashed circle marks the Sun at R = 1 (if “Draw Sun R = 1” is on).
- **Control** (top right): P0 and P1 joysticks and numeric Px/Py, **Previous/Next file** buttons, and **Commit**.
- **Param** (top right): Contour value, power-index, Draw Sun, channel range, channel cadence.
- **Files** (bottom right): Data file list, output CSV path, “Load param from data file (.csv)”.

### Step-by-step: Obtaining and saving px0, py0, px1, py1

1. **Choose data and output CSV**  
   - In **Files**, pick the HDF5 **Data file** (and **Load Data** if you need to change the data directory).  
   - Optionally set **Out .csv** with **Output File** (default is `./manual_corr.csv`).

2. **Tune contour display (Param)**  
   - **Contour value**: Base contour level (blur to apply).  
   - **Power-index**: Exponent for scaling level with frequency (blur to apply).  
   - **Channel range** and **Channel cadence**: Which channels to show and how many to skip.  
   Use these so the contours are visible and not too crowded.

3. **Align contours with P0 and P1 (Control)**  
   - **P0** sets the frequency-dependent part of the offset (px0, py0).  
   - **P1** sets the constant part (px1, py1).  
   - Use the **joysticks** to drag, or type into **Px** and **Py** under P0 and P1.  
   - **Reset** sets that control’s values back to 0.  
   - Adjust until contours line up across frequency in the Contour panel.

4. **Save the parameters**  
   - Click **Commit**.  
   - The app writes one row to the output CSV: **Time** (UTC from the current data filename, no trailing “Z”), **px0, px1, py0, py1**.  
   - If a row with the same Time already exists, that row is updated instead of adding a duplicate.

5. **Move to the next file (optional)**  
   - Use **‹** (previous file) and **›** (next file) in the Control header to change the data file.  
   - If **Load param from data file (.csv)** is checked, the app will try to load existing px0, py0, px1, py1 for the new file’s time from the CSV and pre-fill P0/P1.

6. **Repeat**  
   For each observation file, align contours, then **Commit**. The CSV accumulates (or updates) one row per time, giving you the **px0, py0, px1, py1** needed for refraction correction.

### Output CSV format

```csv
Time,px0,px1,py0,py1
2024-11-21T18:38:06,2.1132970174153646e+18,-4.3287509918212891e+02,-3.8650665283203130e+17,-6.7074890136718750e+01
```

- **Time**: UTC timestamp derived from the data filename (no “Z” suffix).  
- **px0, px1, py0, py1**: Scientific-notation values. Use them in your pipeline with **x_offset = px0/f² + px1**, **y_offset = py0/f² + py1** per channel frequency *f*.

### Tips

- **Load param from data file (.csv)** saves time when stepping through files: the app looks up the CSV row whose Time matches the current file and fills P0/P1 so you can refine instead of starting from zero.  
- If contours are missing or wrong, adjust **Contour value** and **Power-index** (and channel range/cadence) in Param; changes apply after you blur the fields or change focus.  
- **Commit** uses the *current* data file’s timestamp. Use **‹** / **›** to select the correct file before committing.

---

## Summary

1. Put HDF5 files in `data/`, run backend and frontend.  
2. Select a **Data file** and optional **Out .csv**.  
3. Adjust **Contour value** and **Param** so contours are visible.  
4. Use **P0** and **P1** (joysticks or Px/Py) to align contours across frequency.  
5. Click **Commit** to write or update **Time, px0, px1, py0, py1** in the CSV.  
6. Use **‹** / **›** and optionally **Load param from data file** to process more files and build the full correction table.

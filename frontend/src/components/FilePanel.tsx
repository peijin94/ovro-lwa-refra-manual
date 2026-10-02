type FilePanelProps = {
  dataRoot: string
  availableFiles: string[]
  selectedFile: string | null
  onChangeSelectedFile: (filename: string) => void
  onChangeDataRootValue: (path: string) => void
  onApplyDataRoot: () => void
  outputFile: string
  onSelectCsv: () => void
}

export function FilePanel({
  dataRoot,
  availableFiles,
  selectedFile,
  onChangeSelectedFile,
  onChangeDataRootValue,
  onApplyDataRoot,
  outputFile,
  onSelectCsv,
}: FilePanelProps) {
  return (
    <div className="panel file-panel">
      <div className="panel-title">Files</div>
      <div className="file-panel-fields">
        <div className="control-field control-field-wide">
          <label htmlFor="data-file">Data file</label>
          <select
            id="data-file"
            value={selectedFile ?? ''}
            onChange={(e) => onChangeSelectedFile(e.target.value)}
          >
            {availableFiles.length === 0 && <option value="">No files found</option>}
            {availableFiles.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="control-field control-field-wide">
          <label htmlFor="data-dir">Data folder</label>
          <textarea
            id="data-dir"
            rows={2}
            value={dataRoot}
            onChange={(e) => onChangeDataRootValue(e.target.value)}
          />
          <div className="csv-button-row">
            <button type="button" className="load-data-button" onClick={onApplyDataRoot}>
              Select data folder
            </button>
          </div>
        </div>
        <div className="control-field control-field-wide">
          <label htmlFor="output-file">Out .csv</label>
          <textarea id="output-file" rows={2} value={outputFile} readOnly />
          <div className="csv-button-row">
            <button type="button" className="load-data-button" onClick={onSelectCsv}>
              Select .csv
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

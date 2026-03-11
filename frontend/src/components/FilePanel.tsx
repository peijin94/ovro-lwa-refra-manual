type FilePanelProps = {
  dataRoot: string
  availableFiles: string[]
  selectedFile: string | null
  onChangeSelectedFile: (filename: string) => void
  outputFile: string
  onChangeOutputFile: () => void
  autoLoadParams: boolean
  onChangeAutoLoadParams: (value: boolean) => void
}

export function FilePanel({
  dataRoot,
  availableFiles,
  selectedFile,
  onChangeSelectedFile,
  outputFile,
  onChangeOutputFile,
  autoLoadParams,
  onChangeAutoLoadParams,
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
          <div className="control-field-row">
            <button
              type="button"
              className="load-data-button"
              onClick={() => {
                const current = dataRoot || ''
                const next = window.prompt('Enter data directory on server', current)
                if (!next || next === current) return
                onChangeSelectedFile(next)
              }}
            >
              Load Data
            </button>
          </div>
          <div className="data-root-label">Dir: {dataRoot || '(default data/)'}</div>
        </div>
        <div className="control-field control-field-wide">
          <label htmlFor="output-file">Out .csv</label>
          <input id="output-file" type="text" value={outputFile} readOnly />
          <div className="control-field-row">
            <button type="button" className="load-data-button" onClick={onChangeOutputFile}>
              Output File
            </button>
          </div>
        </div>
        <div className="control-field control-field-wide">
          <label htmlFor="load-param-toggle">
            <input
              id="load-param-toggle"
              type="checkbox"
              checked={autoLoadParams}
              onChange={(e) => onChangeAutoLoadParams(e.target.checked)}
              className="control-checkbox"
            />
            Load param from data file (.csv)
          </label>
        </div>
      </div>
    </div>
  )
}

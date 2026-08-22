import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

export default function UploadZone({ onSuccess, hasData }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('replace') // 'replace' | 'append'

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setError('Only .csv files are accepted.')
      return
    }
    const file = acceptedFiles[0]
    if (!file) return

    setError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/upload?mode=${mode}`, { method: 'POST', body: formData })

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: 'Upload failed.' }))
        throw new Error(detail.detail || 'Upload failed.')
      }

      const data = await res.json()
      onSuccess(data)
      const modeLabel = mode === 'append' ? 'Appended &' : 'Cleaned'
      toast.success(`${modeLabel} ${data.students.length} students in ${data.cleaning_report.processing_ms}ms`)
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }, [onSuccess, mode])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    disabled: uploading,
  })

  return (
    <div className="space-y-3" id="upload-section">

      {/* ── Replace / Append toggle (only shown when data already exists) ── */}
      {hasData && (
        <div className="flex items-center gap-2 justify-end" id="upload-mode-toggle">
          <span className="text-xs text-slate-400">Upload mode:</span>
          <div className="flex rounded-lg overflow-hidden border border-surface-300 text-xs font-medium">
            <button
              id="mode-replace"
              onClick={() => setMode('replace')}
              className={`px-3 py-1.5 transition-colors ${
                mode === 'replace'
                  ? 'bg-red-600/80 text-white'
                  : 'bg-surface-200 text-slate-400 hover:text-slate-200'
              }`}
            >
              Replace
            </button>
            <button
              id="mode-append"
              onClick={() => setMode('append')}
              className={`px-3 py-1.5 transition-colors ${
                mode === 'append'
                  ? 'bg-brand-600/80 text-white'
                  : 'bg-surface-200 text-slate-400 hover:text-slate-200'
              }`}
            >
              Append
            </button>
          </div>
          <span className="text-xs text-slate-500 italic">
            {mode === 'append'
              ? '↗ merges with existing data'
              : '⚠ overwrites all existing data'}
          </span>
        </div>
      )}

      {/* ── Dropzone ── */}
      <div
        {...getRootProps()}
        className={`upload-zone ${isDragActive ? 'upload-zone-active' : ''} ${uploading ? 'cursor-wait opacity-70' : ''}`}
        id="upload-zone"
      >
        <input {...getInputProps()} id="csv-file-input" />

        {uploading ? (
          <>
            <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-400 font-medium">
              {mode === 'append' ? 'Merging and cleaning data…' : 'Cleaning your data…'}
            </p>
          </>
        ) : (
          <>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-200
              ${isDragActive ? 'bg-brand-500/20 border border-brand-500' : 'bg-surface-200 border border-surface-300'}`}>
              <svg className={`w-7 h-7 ${isDragActive ? 'text-brand-400' : 'text-slate-400'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            <div className="text-center">
              <p className="text-base font-semibold text-white">
                {isDragActive
                  ? 'Drop your CSV here'
                  : hasData && mode === 'append'
                    ? 'Drop CSV to append to current data'
                    : hasData
                      ? 'Drop CSV to replace current data'
                      : 'Drop your student CSV here'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                or <span className="text-brand-400 font-medium cursor-pointer hover:text-brand-300">click to browse</span>
                <span className="ml-2 text-slate-500">· .csv files only</span>
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-4 py-2">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

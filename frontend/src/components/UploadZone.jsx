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
    <div
      className={`bg-white border-2 border-dashed rounded-2xl shadow-sm flex flex-col items-center gap-5 p-6 transition-all duration-200 cursor-pointer
        ${isDragActive ? 'border-brand-500 bg-brand-50/60' : 'border-surface-400'}
        ${uploading ? 'cursor-wait opacity-70' : ''}`}
      id="upload-section"
    >
      {/* ── Upload dropzone area ── */}
      <div
        {...getRootProps()}
        className="flex flex-col items-center gap-4 w-full text-center outline-none"
        id="upload-zone"
      >
        <input {...getInputProps()} id="csv-file-input" />

        {uploading ? (
          <>
            <div className="w-14 h-14 rounded-full border-[3px] border-brand-600 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-500 font-semibold">
              {mode === 'append' ? 'Merging data…' : 'Cleaning data…'}
            </p>
          </>
        ) : (
          <>
            {/* Blue circle icon */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-200
              ${isDragActive ? 'bg-brand-500' : 'bg-brand-600'}`}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            <div>
              <p className="text-sm font-black text-slate-900 uppercase tracking-wider leading-tight">
                Upload Student<br />Data
              </p>
              <p className="text-xs text-slate-400 mt-1.5 leading-snug">
                Drag and drop CSV files here to<br />update the pipeline
              </p>
            </div>

            {/* Browse button — pointer-events-none so dropzone handles the click */}
            <div className="px-6 py-2 rounded-xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest pointer-events-none shadow-md shadow-brand-900/20">
              Browse Files
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="w-full h-px bg-surface-300" />

      {/* ── Upload mode selector — always visible ── */}
      <div className="w-full" id="upload-mode-toggle">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5 text-center">
          Upload Mode
        </p>
        <div className="grid grid-cols-2 gap-2">

          {/* Replace option */}
          <button
            id="mode-replace"
            type="button"
            onClick={() => setMode('replace')}
            className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all duration-150 text-left
              ${mode === 'replace'
                ? 'border-red-400 bg-red-50 shadow-sm'
                : 'border-surface-300 bg-surface-200/60 hover:border-slate-400 hover:bg-surface-200'
              }`}
          >
            {/* Icon */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center
              ${mode === 'replace' ? 'bg-red-500' : 'bg-slate-300'}`}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-wider
              ${mode === 'replace' ? 'text-red-600' : 'text-slate-500'}`}>
              Replace
            </span>
            <span className={`text-[9px] leading-tight text-center
              ${mode === 'replace' ? 'text-red-400' : 'text-slate-400'}`}>
              Overwrites all<br/>existing data
            </span>
            {mode === 'replace' && (
              <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-red-500 flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>

          {/* Append option */}
          <button
            id="mode-append"
            type="button"
            onClick={() => setMode('append')}
            className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all duration-150
              ${mode === 'append'
                ? 'border-brand-500 bg-brand-50 shadow-sm'
                : 'border-surface-300 bg-surface-200/60 hover:border-slate-400 hover:bg-surface-200'
              }`}
          >
            {/* Icon */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center
              ${mode === 'append' ? 'bg-brand-600' : 'bg-slate-300'}`}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-wider
              ${mode === 'append' ? 'text-brand-600' : 'text-slate-500'}`}>
              Append
            </span>
            <span className={`text-[9px] leading-tight text-center
              ${mode === 'append' ? 'text-brand-400' : 'text-slate-400'}`}>
              Merges with<br/>existing data
            </span>
            {mode === 'append' && (
              <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-brand-600 flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>

        </div>

        {/* Contextual hint */}
        <p className={`text-[10px] mt-2 text-center font-medium transition-colors
          ${mode === 'replace' ? 'text-red-400' : 'text-brand-500'}`}>
          {mode === 'replace'
            ? '⚠ New upload will delete all current records'
            : '↗ New upload will merge with current records'}
        </p>
      </div>
    </div>
  )
}

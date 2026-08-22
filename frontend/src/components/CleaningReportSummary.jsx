import { useState } from 'react'

const StatPill = ({ label, value, color = 'slate' }) => {
  const colors = {
    yellow:  'bg-yellow-900/30 text-yellow-300 border-yellow-800',
    blue:    'bg-blue-900/30 text-blue-300 border-blue-800',
    purple:  'bg-purple-900/30 text-purple-300 border-purple-800',
    red:     'bg-red-900/30 text-red-400 border-red-900',
    orange:  'bg-orange-900/30 text-orange-300 border-orange-800',
    slate:   'bg-surface-200 text-slate-300 border-surface-300',
    green:   'bg-emerald-900/30 text-emerald-300 border-emerald-800',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${colors[color]}`}>
      <span className="font-bold text-base">{value}</span>
      <span className="opacity-80">{label}</span>
    </span>
  )
}

export default function CleaningReportSummary({ report }) {
  const [open, setOpen] = useState(false)

  const {
    rows_raw,
    rows_cleaned,
    duplicates_removed,
    typos_fixed,
    incomplete_rows,
    invalid_rows,
    processing_ms,
  } = report

  const hasChanges = duplicates_removed > 0 || typos_fixed > 0 || incomplete_rows > 0 || invalid_rows > 0

  return (
    <div className="card border-brand-500/30 bg-brand-600/5" id="cleaning-report">
      <button
        className="w-full flex items-center justify-between gap-4 text-left group"
        onClick={() => setOpen(o => !o)}
        id="cleaning-report-toggle"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Cleaning complete —{' '}
              <span className="text-brand-400">{rows_cleaned} rows</span> from {rows_raw} raw
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasChanges ? 'Issues were found. Click to see details.' : 'No issues found. Data was clean.'}
              <span className="ml-2 text-slate-500">· {processing_ms}ms</span>
            </p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-5 pt-5 border-t border-surface-200">
          <div className="flex flex-wrap gap-2" id="cleaning-details">
            <StatPill value={duplicates_removed} label="duplicates removed"   color="yellow" />
            <StatPill value={typos_fixed}        label="typos / text fixed"   color="blue"   />
            {incomplete_rows > 0 && (
              <StatPill value={incomplete_rows}  label="incomplete rows flagged" color="orange" />
            )}
            {invalid_rows > 0 && (
              <StatPill value={invalid_rows}     label="invalid scores (>100)"  color="red"    />
            )}
            <StatPill value={`${processing_ms}ms`} label="pipeline time"     color="green"  />
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-surface-200 rounded-lg p-3">
              <div className="text-slate-400 text-xs mb-1">Raw rows</div>
              <div className="text-white font-semibold">{rows_raw}</div>
            </div>
            <div className="bg-surface-200 rounded-lg p-3">
              <div className="text-slate-400 text-xs mb-1">After cleaning</div>
              <div className="text-white font-semibold">{rows_cleaned}</div>
            </div>
            <div className="bg-surface-200 rounded-lg p-3">
              <div className="text-slate-400 text-xs mb-1">Incomplete</div>
              <div className={`font-semibold ${incomplete_rows > 0 ? 'text-orange-400' : 'text-slate-400'}`}>
                {incomplete_rows}
              </div>
            </div>
            <div className="bg-surface-200 rounded-lg p-3">
              <div className="text-slate-400 text-xs mb-1">Speed</div>
              <div className="text-emerald-400 font-semibold">{processing_ms}ms</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

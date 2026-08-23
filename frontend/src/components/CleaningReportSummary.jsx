import { useState } from 'react'

const StatPill = ({ label, value, color = 'slate' }) => {
  const colors = {
    yellow:  'bg-yellow-50 text-yellow-700 border-yellow-200',
    blue:    'bg-blue-50 text-blue-700 border-blue-200',
    purple:  'bg-purple-50 text-purple-700 border-purple-200',
    red:     'bg-red-50 text-red-600 border-red-200',
    orange:  'bg-orange-50 text-orange-600 border-orange-200',
    slate:   'bg-surface-200 text-slate-600 border-surface-300',
    green:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${colors[color]}`}>
      <span className="font-black text-base">{value}</span>
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
    <div className="card border-brand-200 bg-brand-50/50" id="cleaning-report">
      <button
        className="w-full flex items-center justify-between gap-4 text-left group"
        onClick={() => setOpen(o => !o)}
        id="cleaning-report-toggle"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-100 border border-brand-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              Cleaning complete —{' '}
              <span className="text-brand-600">{rows_cleaned} rows</span> from {rows_raw} raw
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasChanges ? 'Issues were found. Click to see details.' : 'No issues found. Data was clean.'}
              <span className="ml-2 text-slate-400">· {processing_ms}ms</span>
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
        <div className="mt-5 pt-5 border-t border-brand-200">
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
            <div className="bg-white rounded-xl p-3 border border-surface-300">
              <div className="text-slate-400 text-xs mb-1 font-medium">Raw rows</div>
              <div className="text-slate-900 font-bold">{rows_raw}</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-surface-300">
              <div className="text-slate-400 text-xs mb-1 font-medium">After cleaning</div>
              <div className="text-slate-900 font-bold">{rows_cleaned}</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-surface-300">
              <div className="text-slate-400 text-xs mb-1 font-medium">Incomplete</div>
              <div className={`font-bold ${incomplete_rows > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                {incomplete_rows ?? 0}
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-surface-300">
              <div className="text-slate-400 text-xs mb-1 font-medium">Speed</div>
              <div className="text-brand-600 font-bold">{processing_ms}ms</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'

// Qualification rule — mirrors studentQualifies in App.jsx.
// A student appears un-dimmed only when they are Active, have no data-quality
// flags, and their total meets the minimum threshold.
const qualifies = (s, minTotal) =>
  s.status === 'Active' && !s.is_incomplete && !s.is_invalid && (s.total ?? 0) >= minTotal

// Simple toggle Switch component
function Switch({ checked, onChange, id }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`switch ${checked ? 'switch-on' : 'switch-off'}`}
    >
      <span className="sr-only">{checked ? 'Active' : 'Debarred'}</span>
      <span className={`switch-thumb ${checked ? 'switch-thumb-on' : 'switch-thumb-off'}`} />
    </button>
  )
}

function ScoreCell({ value, max = 100, invalid = false }) {
  const pct = Math.min(100, ((value ?? 0) / max) * 100)
  return (
    <div className="flex flex-col gap-1 min-w-[60px]">
      <span className={`text-sm font-semibold tabular-nums ${invalid ? 'text-red-500' : 'text-slate-700'}`}>
        {value?.toFixed(0) ?? '—'}
      </span>
      <div className="h-1 w-full bg-surface-300 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${invalid ? 'bg-red-400' : 'bg-brand-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Filter dropdown ──────────────────────────────────────────────────────────
function FilterDropdown({ filters, onChange, onClear, activeCount }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const statusOptions  = [
    { label: 'All',           value: 'All' },
    { label: 'Qualified',     value: 'Active' },
    { label: 'Not Qualified', value: 'NotQualified' },
    { label: 'Debarred',      value: 'Debarred' },
  ]
  const flaggedOptions = ['All', 'Yes', 'No']

  return (
    <div className="relative" ref={ref}>
      <button
        id="filter-btn"
        onClick={() => setOpen(o => !o)}
        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors relative
          ${open || activeCount > 0
            ? 'border-brand-400 bg-brand-50 text-brand-600'
            : 'border-surface-300 bg-surface-200 text-slate-500 hover:text-brand-600 hover:border-brand-300'
          }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {/* Active filter badge */}
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-black flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 bg-white border border-surface-300 rounded-2xl shadow-xl shadow-slate-900/10 p-4 space-y-4">

          {/* Status filter */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Status</p>
            <div className="flex gap-1.5 flex-wrap">
              {statusOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onChange('status', opt.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors
                    ${filters.status === opt.value
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-surface-200 text-slate-500 hover:bg-surface-300'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Flagged filter */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Flagged</p>
            <div className="flex gap-1.5 flex-wrap">
              {flaggedOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => onChange('flagged', opt)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors
                    ${filters.flagged === opt
                      ? opt === 'Yes' ? 'bg-orange-500 text-white shadow-sm' : 'bg-brand-600 text-white shadow-sm'
                      : 'bg-surface-200 text-slate-500 hover:bg-surface-300'
                    }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {activeCount > 0 && (
            <button
              onClick={() => { onClear(); setOpen(false) }}
              className="w-full text-xs font-bold text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 rounded-lg py-1.5 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main table ───────────────────────────────────────────────────────────────
export default function StudentTable({ students, minTotal, onToggle, filters, onFiltersChange }) {
  const handleFilterChange = (key, value) => onFiltersChange({ ...filters, [key]: value })
  const handleClearFilters = () => onFiltersChange({ status: 'All', flagged: 'All' })

  const activeFilterCount = (filters.status !== 'All' ? 1 : 0) + (filters.flagged !== 'All' ? 1 : 0)

  // Apply filters
  const visibleStudents = students.filter(s => {
    const isFlagged = s.is_incomplete || s.is_invalid
    if (filters.status === 'Active')       { if (!qualifies(s, minTotal)) return false }
    else if (filters.status === 'Debarred')     { if (s.status !== 'Debarred') return false }
    else if (filters.status === 'NotQualified') { if (s.status === 'Debarred' || qualifies(s, minTotal)) return false }
    if (filters.flagged === 'Yes' && !isFlagged) return false
    if (filters.flagged === 'No'  &&  isFlagged) return false
    return true
  })

  const columns = [
    { key: 'name',    label: 'Student Name' },
    { key: 'gender',  label: 'Gender' },
    { key: 'grade',   label: 'Grade' },
    { key: 'math',    label: 'Math' },
    { key: 'science', label: 'Science' },
    { key: 'english', label: 'English' },
    { key: 'total',   label: 'Total Score' },
    { key: 'status',  label: 'Status' },
    { key: 'flagged', label: 'Flagged' },
    { key: 'action',  label: 'Action' },
  ]

  return (
    <div className="card p-0" id="student-table">

      {/* Card header */}
      <div className="px-6 py-4 border-b border-surface-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            Recent Candidates
          </h2>
          <span className="text-xs text-slate-400 font-semibold">
            {visibleStudents.length} of {students.length}
          </span>
          {/* Active filter pills */}
          {filters.status !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-[10px] font-bold text-brand-600">
              {{ Active: 'Qualified', NotQualified: 'Not Qualified', Debarred: 'Debarred' }[filters.status] ?? filters.status}
              <button onClick={() => handleFilterChange('status', 'All')} className="hover:text-brand-800">✕</button>
            </span>
          )}
          {filters.flagged !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-[10px] font-bold text-orange-600">
              Flagged: {filters.flagged}
              <button onClick={() => handleFilterChange('flagged', 'All')} className="hover:text-orange-800">✕</button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <FilterDropdown
            filters={filters}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
            activeCount={activeFilterCount}
          />
          <button className="w-8 h-8 rounded-lg border border-surface-300 bg-surface-200 flex items-center justify-center text-slate-500 hover:text-brand-600 hover:border-brand-300 transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-b-2xl">
        <table className="w-full" aria-label="Student data table">
          <thead className="bg-surface-200/70">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="table-header text-left whitespace-nowrap">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleStudents.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-sm text-slate-400 font-medium">
                  No students match the current filters.
                  <button onClick={handleClearFilters} className="ml-2 text-brand-500 font-bold hover:underline">Clear filters</button>
                </td>
              </tr>
            ) : (
              visibleStudents.map((s) => {
                const isQualifying   = qualifies(s, minTotal)
                const isDebarred     = s.status === 'Debarred'
                const isFlagged      = s.is_incomplete || s.is_invalid
                const mathInvalid    = s.math != null && s.math > 100
                const scienceInvalid = s.science != null && s.science > 100
                const englishInvalid = s.english != null && s.english > 100

                return (
                  <tr
                    key={s.id}
                    id={`student-row-${s.id}`}
                    className={`table-row ${!isQualifying ? 'opacity-50' : ''}`}
                  >
                    {/* Name */}
                    <td className="table-cell whitespace-nowrap">
                      <span className={`font-semibold ${isDebarred ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {s.name ?? <span className="italic text-slate-400">No name</span>}
                      </span>
                    </td>

                    {/* Gender */}
                    <td className="table-cell">
                      <span className="text-slate-600">{s.gender ?? <span className="text-slate-300">—</span>}</span>
                    </td>

                    {/* Grade */}
                    <td className="table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-200 text-slate-600 text-xs font-semibold">
                        {s.grade ?? <span className="text-slate-300">—</span>}
                      </span>
                    </td>

                    {/* Math */}
                    <td className="table-cell">
                      <ScoreCell value={s.math} invalid={mathInvalid} />
                    </td>

                    {/* Science */}
                    <td className="table-cell">
                      <ScoreCell value={s.science} invalid={scienceInvalid} />
                    </td>

                    {/* English */}
                    <td className="table-cell">
                      <ScoreCell value={s.english} invalid={englishInvalid} />
                    </td>

                    {/* Total score */}
                    <td className="table-cell">
                      <span className={`font-black tabular-nums text-base ${
                        isQualifying ? 'text-slate-900' : 'text-slate-400'
                      }`}>
                        {s.total?.toFixed(1) ?? '—'}
                      </span>
                    </td>

                    {/* Status badge — reflects real qualification state */}
                  <td className="table-cell">
                    {isDebarred ? (
                      <span className="badge-debarred">Debarred</span>
                    ) : isQualifying ? (
                      <span className="badge-qualified">Qualified</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-400 border border-slate-200">
                        Not Qualified
                      </span>
                    )}
                  </td>

                    {/* Flagged */}
                    <td className="table-cell">
                      {isFlagged ? (
                        <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">Yes</span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">No</span>
                      )}
                    </td>

                    {/* Toggle action */}
                    <td className="table-cell">
                      <Switch
                        id={`toggle-${s.id}`}
                        checked={s.status === 'Active'}
                        onChange={() => onToggle(s.id, s.status)}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

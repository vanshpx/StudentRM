import { useState, useMemo, useDeferredValue } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import UploadZone from './components/UploadZone.jsx'
import CleaningReportSummary from './components/CleaningReportSummary.jsx'
import StudentTable from './components/StudentTable.jsx'
import ScoreFilterInput from './components/ScoreFilterInput.jsx'
import ExportButton from './components/ExportButton.jsx'

// A student "qualifies" for the shortlist when they are Active,
// have no data quality flags, and meet the minimum score threshold.
const studentQualifies = (s, minTotal) =>
  s.status === 'Active' && !s.is_incomplete && !s.is_invalid && (s.total ?? 0) >= minTotal

// ── Root component — owns all shared state ──────────────────────────────────
export default function App() {
  const [students, setStudents] = useState([])
  const [minTotal, setMinTotal] = useState(0)
  // deferredMinTotal lets React batch the expensive table re-render at lower
  // priority — stat boxes use minTotal directly and update instantly.
  const deferredMinTotal = useDeferredValue(minTotal)
  const [cleaningReport, setCleaningReport] = useState(null)
  // Table filter state — lifted here so ExportButton can read it
  const [tableFilters, setTableFilters] = useState({ status: 'All', flagged: 'All' })

  // ── Hydrate from SQLite on page load / refresh ──────────────────────────
  useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await fetch('/api/students')
      if (!res.ok) throw new Error('Failed to load students')
      const data = await res.json()
      setStudents(data.students)
      return data.students
    },
  })

  // ── Optimistic toggle mutation (Section 9 of AGENTS.md) ─────────────────
  const toggleMutation = useMutation({
    mutationFn: ({ id, status }) =>
      fetch(`/api/students/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(res => {
        if (!res.ok) throw new Error('PATCH failed')
        return res.json()
      }),

    onMutate: ({ id, status }) => {
      const previousStudents = students
      setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s))
      return { previousStudents }
    },

    onError: (_err, _vars, context) => {
      setStudents(context.previousStudents)
      toast.error('Failed to update status. Please try again.')
    },
  })

  const handleToggle = (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Debarred' : 'Active'
    toggleMutation.mutate({ id, status: newStatus })
  }

  // ── Clear all records ────────────────────────────────────────────────────
  const handleClearAll = async () => {
    if (!window.confirm('Delete all current records? This cannot be undone.')) return
    try {
      const res = await fetch('/api/students', { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setStudents([])
      setCleaningReport(null)
      setMinTotal(0)
      toast.success('All records cleared.')
    } catch {
      toast.error('Failed to clear records. Please try again.')
    }
  }

  // ── Qualifying shortlist — useMemo, zero network calls ─────────────────
  // Mirrors the qualifies() logic in StudentTable so stat cards stay in sync.
  const filteredStudents = useMemo(
    () => students.filter(s => studentQualifies(s, minTotal)),
    [students, minTotal]
  )

  // ── Derived stats ────────────────────────────────────────────────────────
  const avgTotal = useMemo(() => {
    if (filteredStudents.length === 0) return 0
    const sum = filteredStudents.reduce((acc, s) => acc + (s.total ?? 0), 0)
    return sum / filteredStudents.length
  }, [filteredStudents])

  const flaggedCount = useMemo(
    () => students.filter(s => s.is_incomplete || s.is_invalid).length,
    [students]
  )

  // Max possible total from the actual dataset — drives the ScoreFilterInput ceiling
  const maxTotal = useMemo(
    () => Math.ceil(Math.max(0, ...students.map(s => s.total ?? 0))),
    [students]
  )

  // ── Upload success handler ───────────────────────────────────────────────
  const handleUploadSuccess = ({ students: newStudents, cleaning_report }) => {
    setStudents(newStudents)
    setCleaningReport(cleaning_report)
    setMinTotal(0)
    setTableFilters({ status: 'All', flagged: 'All' }) // reset filters on new upload
  }

  const hasData = students.length > 0

  return (
    <div className="min-h-screen bg-surface text-slate-800">

      {/* ── Header ── */}
      <header className="bg-white border-b border-surface-300 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-widest">
              Recruitment Manager
            </h1>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {hasData && (
              <button
                id="clear-all-btn"
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  bg-red-50 text-red-500 border border-red-200
                  hover:bg-red-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
            )}
            <ExportButton minTotal={minTotal} filters={tableFilters} />
            {/* Profile avatar placeholder */}
            <div className="w-9 h-9 rounded-full bg-surface-300 border-2 border-surface-400 overflow-hidden flex-shrink-0 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Top section: Upload + Stats circle ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_220px] gap-6 items-center">

          {/* ── Left: Upload zone card ── */}
          <div className="w-full">
            <UploadZone onSuccess={handleUploadSuccess} hasData={hasData} />
          </div>

          {/* ── Center: Circular stats widget ── */}
          <div className="flex items-center justify-center py-8">
            {/* Constrain to a max size and use padding to show the ring label */}
            <div className="relative" style={{ width: 'min(380px, 100%)', aspectRatio: '1' }}>

              {/* Outer blue ring */}
              <div className="absolute inset-0 rounded-full border-[13px] border-brand-600 shadow-2xl shadow-brand-900/25" />

              {/* Inner fill */}
              <div className="absolute inset-[13px] rounded-full bg-surface-200" />

              {/* "Data Cleaning Status" pill — sits ON the top border */}
              <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: '-1px', transform: 'translate(-50%, -50%)' }}>
                <span className="bg-white border border-surface-300 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm whitespace-nowrap">
                  Data Cleaning Status&nbsp;
                  {cleaningReport
                    ? <span className="text-brand-600">100%</span>
                    : <span className="text-slate-400">—</span>
                  }
                </span>
              </div>

              {/* 2×2 stat cards grid, inset from the ring border */}
              <div className="absolute grid grid-cols-2 gap-2.5" style={{ inset: '22px', padding: '6px' }}>

                {/* Students Qualify */}
                <div className="bg-white rounded-2xl p-3.5 flex flex-col justify-between shadow-sm border border-surface-300" id="stat-qualify">
                  <div className="flex items-start justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Students<br/>Qualify</span>
                    <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-900 leading-none mt-2">{filteredStudents.length.toLocaleString()}</div>
                    {hasData && (
                      <div className="text-[9px] text-brand-600 font-semibold mt-1 flex items-center gap-0.5">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        Active · above threshold
                      </div>
                    )}
                  </div>
                </div>

                {/* Average Total */}
                <div className="bg-white rounded-2xl p-3.5 flex flex-col justify-between shadow-sm border border-surface-300" id="stat-avg">
                  <div className="flex items-start justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Average<br/>Total</span>
                    <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-black text-slate-900 leading-none mt-2">{avgTotal.toFixed(1)}</div>
                </div>

                {/* Flagged Records */}
                <div className={`bg-white rounded-2xl p-3.5 flex flex-col justify-between shadow-sm border ${flaggedCount > 0 ? 'border-orange-200' : 'border-surface-300'}`} id="stat-flagged">
                  <div className="flex items-start justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Flagged<br/>Records</span>
                    <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  </div>
                  <div className={`text-2xl font-black leading-none mt-2 ${flaggedCount > 0 ? 'text-orange-500' : 'text-slate-900'}`}>
                    {flaggedCount}
                  </div>
                </div>

                {/* Min Total Score */}
                <div className="bg-white rounded-2xl p-3.5 flex flex-col justify-between shadow-sm border border-surface-300" id="stat-min-total">
                  <div className="flex items-start justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Min Total<br/>Score</span>
                    <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-black text-slate-900 leading-none mt-2">{minTotal.toFixed(1)}</div>
                </div>

              </div>
            </div>
          </div>

          {/* ── Right: Score filter — always rendered, collapses gracefully ── */}
          <div className="w-full">
            <ScoreFilterInput value={minTotal} onChange={setMinTotal} max={maxTotal} />
          </div>

        </div>

        {/* ── Cleaning report (collapsible, only after upload) ── */}
        {cleaningReport && (
          <CleaningReportSummary report={cleaningReport} />
        )}

        {/* ── Recent Candidates table ── */}
        {hasData ? (
          <StudentTable
            students={students}
            minTotal={deferredMinTotal}
            onToggle={handleToggle}
            filters={tableFilters}
            onFiltersChange={setTableFilters}
          />
        ) : (
          <div className="card text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">No data yet</h2>
            <p className="text-sm text-slate-400">Upload a student CSV above to get started.</p>
          </div>
        )}

      </main>
    </div>
  )
}

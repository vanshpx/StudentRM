import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import UploadZone from './components/UploadZone.jsx'
import CleaningReportSummary from './components/CleaningReportSummary.jsx'
import StudentTable from './components/StudentTable.jsx'
import ScoreFilterInput from './components/ScoreFilterInput.jsx'
import ShortlistStats from './components/ShortlistStats.jsx'
import ExportButton from './components/ExportButton.jsx'

// ── Root component — owns all shared state ──────────────────────────────────
export default function App() {
  const [students, setStudents] = useState([])
  const [minTotal, setMinTotal] = useState(0)
  const [cleaningReport, setCleaningReport] = useState(null)

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
      // Snapshot for rollback
      const previousStudents = students
      // Optimistic update — instant UI feedback
      setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s))
      return { previousStudents }
    },

    onError: (_err, _vars, context) => {
      // Revert on failure
      setStudents(context.previousStudents)
      toast.error('Failed to update status. Please try again.')
    },
  })

  const handleToggle = (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Debarred' : 'Active'
    toggleMutation.mutate({ id, status: newStatus })
  }

  // ── Client-side filter — useMemo, zero network calls ────────────────────
  const filteredStudents = useMemo(
    () => students.filter(
      s => s.status === 'Active' && (s.total ?? 0) >= minTotal
    ),
    [students, minTotal]
  )

  // ── Upload success handler ───────────────────────────────────────────────
  const handleUploadSuccess = ({ students: newStudents, cleaning_report }) => {
    setStudents(newStudents)
    setCleaningReport(cleaning_report)
    setMinTotal(0)
  }

  const hasData = students.length > 0

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      {/* ── Header ── */}
      <header className="border-b border-surface-200 bg-surface-100/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-400 flex items-center justify-center text-white text-sm font-bold">
              SP
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Student Pipeline</h1>
              <p className="text-xs text-slate-400 mt-0.5">Eligibility Shortlisting Tool</p>
            </div>
          </div>
          {hasData && (
            <ExportButton minTotal={minTotal} />
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Upload zone (always visible) ── */}
        <UploadZone onSuccess={handleUploadSuccess} hasData={hasData} />

        {/* ── Cleaning report (only after upload) ── */}
        {cleaningReport && (
          <CleaningReportSummary report={cleaningReport} />
        )}

        {/* ── Stats + filter row ── */}
        {hasData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ShortlistStats filteredStudents={filteredStudents} />
            <div className="md:col-span-1 flex items-end">
              <ScoreFilterInput value={minTotal} onChange={setMinTotal} />
            </div>
          </div>
        )}

        {/* ── Student table ── */}
        {hasData ? (
          <StudentTable students={students} minTotal={minTotal} onToggle={handleToggle} />
        ) : (
          /* ── Empty state ── */
          <div className="card text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">No data yet</h2>
            <p className="text-sm text-slate-400">Upload a student CSV above to get started.</p>
          </div>
        )}
      </main>
    </div>
  )
}

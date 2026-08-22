import { useMemo } from 'react'

export default function ShortlistStats({ filteredStudents, allStudents = [] }) {
  const avg = useMemo(() => {
    if (filteredStudents.length === 0) return 0
    const sum = filteredStudents.reduce((acc, s) => acc + (s.total ?? 0), 0)
    return sum / filteredStudents.length
  }, [filteredStudents])

  const flaggedCount = useMemo(
    () => allStudents.filter(s => s.is_incomplete || s.is_invalid).length,
    [allStudents]
  )

  return (
    <div className="col-span-2 grid grid-cols-3 gap-4" id="shortlist-stats">

      <div className="stat-card">
        <div className="stat-label">Students qualify</div>
        <div className="stat-value">{filteredStudents.length}</div>
        <div className="text-xs text-slate-500 mt-1">Active · above threshold</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Average total</div>
        <div className="stat-value">{avg.toFixed(1)}</div>
        <div className="text-xs text-slate-500 mt-1">Among qualifying students</div>
      </div>

      <div className={`stat-card ${flaggedCount > 0 ? 'border border-orange-800/60 bg-orange-900/10' : ''}`}
        id="stat-flagged">
        <div className="stat-label">Flagged records</div>
        <div className={`text-2xl font-bold tabular-nums ${flaggedCount > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
          {flaggedCount}
        </div>
        <div className="text-xs text-slate-500 mt-1">Incomplete or invalid</div>
      </div>

    </div>
  )
}

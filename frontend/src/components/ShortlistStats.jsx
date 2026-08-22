import { useMemo } from 'react'

export default function ShortlistStats({ filteredStudents }) {
  const avg = useMemo(() => {
    if (filteredStudents.length === 0) return 0
    const sum = filteredStudents.reduce((acc, s) => acc + (s.total ?? 0), 0)
    return sum / filteredStudents.length
  }, [filteredStudents])

  return (
    <div className="col-span-2 grid grid-cols-2 gap-4" id="shortlist-stats">
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
    </div>
  )
}

// Simple toggle Switch component (no external shadcn dependency needed)
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

function ScoreBar({ value, max = 100, invalid = false }) {
  const pct = Math.min(100, ((value ?? 0) / max) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm tabular-nums w-8 text-right ${invalid ? 'text-red-400 font-semibold' : ''}`}>
        {value?.toFixed(0) ?? '—'}
      </span>
      <div className="flex-1 h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${invalid ? 'bg-red-500' : 'bg-gradient-to-r from-brand-600 to-indigo-400'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

function FlagBadge({ isIncomplete, isInvalid }) {
  if (!isIncomplete && !isInvalid) return null
  return (
    <div className="flex flex-col gap-1">
      {isIncomplete && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-900/30 text-orange-300 border border-orange-800">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Incomplete
        </span>
      )}
      {isInvalid && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-900">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M6 18L18 6M6 6l12 12" />
          </svg>
          Invalid score
        </span>
      )}
    </div>
  )
}

export default function StudentTable({ students, minTotal, onToggle }) {
  const qualifies = (s) => s.status === 'Active' && !s.is_incomplete && (s.total ?? 0) >= minTotal

  return (
    <div className="card p-0 overflow-hidden" id="student-table">
      <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          All Students
          <span className="ml-2 text-slate-400 font-normal">({students.length} total)</span>
        </h2>
        <p className="text-xs text-slate-500">
          Grayed rows are Debarred, below threshold, or flagged
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" aria-label="Student data table">
          <thead className="bg-surface-200/50">
            <tr>
              {['Name', 'Gender', 'Grade', 'Math', 'Science', 'English', 'Total', 'Flags', 'Status'].map(col => (
                <th key={col} className="table-header text-left">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const isQualifying = qualifies(s)
              const isDebarred = s.status === 'Debarred'
              const mathInvalid = s.math != null && s.math > 100
              const scienceInvalid = s.science != null && s.science > 100
              const englishInvalid = s.english != null && s.english > 100

              return (
                <tr
                  key={s.id}
                  id={`student-row-${s.id}`}
                  className={`table-row ${!isQualifying ? 'opacity-40' : ''}`}
                >
                  <td className={`table-cell font-medium ${isDebarred ? 'line-through text-slate-500' : 'text-white'}`}>
                    {s.name ?? <span className="italic text-slate-600">No name</span>}
                  </td>
                  <td className="table-cell">{s.gender ?? <span className="text-slate-600">—</span>}</td>
                  <td className="table-cell">{s.grade ?? <span className="text-slate-600">—</span>}</td>
                  <td className="table-cell">
                    <ScoreBar value={s.math} max={100} invalid={mathInvalid} />
                  </td>
                  <td className="table-cell">
                    <ScoreBar value={s.science} max={100} invalid={scienceInvalid} />
                  </td>
                  <td className="table-cell">
                    <ScoreBar value={s.english} max={100} invalid={englishInvalid} />
                  </td>
                  <td className="table-cell">
                    <span className={`font-bold tabular-nums ${
                      isQualifying ? 'text-brand-400' : 'text-slate-500'
                    }`}>
                      {s.total?.toFixed(1) ?? '—'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <FlagBadge isIncomplete={s.is_incomplete} isInvalid={s.is_invalid} />
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`toggle-${s.id}`}
                        checked={s.status === 'Active'}
                        onChange={() => onToggle(s.id, s.status)}
                      />
                      <span className={`text-xs font-medium ${isDebarred ? 'text-red-400' : 'text-emerald-400'}`}>
                        {s.status}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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

function ScoreBar({ value, max = 300 }) {
  const pct = Math.min(100, ((value ?? 0) / max) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm tabular-nums w-8 text-right">{value?.toFixed(0) ?? '—'}</span>
      <div className="flex-1 h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-600 to-indigo-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function StudentTable({ students, minTotal, onToggle }) {
  const qualifies = (s) => s.status === 'Active' && (s.total ?? 0) >= minTotal

  return (
    <div className="card p-0 overflow-hidden" id="student-table">
      <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          All Students
          <span className="ml-2 text-slate-400 font-normal">({students.length} total)</span>
        </h2>
        <p className="text-xs text-slate-500">
          Grayed rows are Debarred or below the score threshold
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" aria-label="Student data table">
          <thead className="bg-surface-200/50">
            <tr>
              {['Name', 'Gender', 'Grade', 'Math', 'Science', 'English', 'Total', 'Status'].map(col => (
                <th key={col} className="table-header text-left">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const isQualifying = qualifies(s)
              const isDebarred = s.status === 'Debarred'

              return (
                <tr
                  key={s.id}
                  id={`student-row-${s.id}`}
                  className={`table-row ${!isQualifying ? 'opacity-40' : ''}`}
                >
                  <td className={`table-cell font-medium ${isDebarred ? 'line-through text-slate-500' : 'text-white'}`}>
                    {s.name}
                  </td>
                  <td className="table-cell">{s.gender ?? <span className="text-slate-600">—</span>}</td>
                  <td className="table-cell">{s.grade ?? <span className="text-slate-600">—</span>}</td>
                  <td className="table-cell">
                    <ScoreBar value={s.math} max={100} />
                  </td>
                  <td className="table-cell">
                    <ScoreBar value={s.science} max={100} />
                  </td>
                  <td className="table-cell">
                    <ScoreBar value={s.english} max={100} />
                  </td>
                  <td className="table-cell">
                    <span className={`font-bold tabular-nums ${
                      isQualifying ? 'text-brand-400' : 'text-slate-500'
                    }`}>
                      {s.total?.toFixed(1) ?? '—'}
                    </span>
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

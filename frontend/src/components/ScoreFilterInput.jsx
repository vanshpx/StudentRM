export default function ScoreFilterInput({ value, onChange }) {
  return (
    <div className="card w-full" id="score-filter-card">
      <label htmlFor="min-total-input" className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
        Min Total Score
      </label>

      {/* Large numeric display */}
      <div className="text-4xl font-black text-slate-900 tabular-nums mb-3">
        {value.toFixed(1)}
      </div>

      <input
        id="min-total-input"
        type="range"
        min={0}
        max={300}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="w-full accent-brand-600 cursor-pointer h-2 rounded-full"
        aria-label="Minimum total score filter"
      />

      <div className="flex justify-between text-xs text-slate-400 mt-1 font-medium">
        <span>0</span>
        <span>300</span>
      </div>

    </div>
  )
}

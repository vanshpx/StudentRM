export default function ScoreFilterInput({ value, onChange }) {
  return (
    <div className="card w-full" id="score-filter-card">
      <label htmlFor="min-total-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
        Minimum Total Score
      </label>
      <div className="relative">
        <input
          id="min-total-input"
          type="number"
          min={0}
          max={300}
          step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="input pr-12"
          placeholder="0"
          aria-label="Minimum total score filter"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
          / 300
        </span>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Shortlist updates instantly — no button needed
      </p>
    </div>
  )
}

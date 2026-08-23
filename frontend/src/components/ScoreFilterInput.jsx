import { useState, useEffect } from 'react'

export default function ScoreFilterInput({ value, onChange, max = 300 }) {
  const [raw, setRaw] = useState(value === 0 ? '' : String(value))

  // Sync back when parent resets to 0 (e.g. new upload)
  useEffect(() => {
    if (value === 0) setRaw('')
  }, [value])

  // If max shrinks below current input, clamp down
  useEffect(() => {
    if (value > max) {
      onChange(max)
      setRaw(String(max))
    }
  }, [max])

  const handleChange = (e) => {
    const text = e.target.value
    setRaw(text)

    if (text === '' || text === '-') { onChange(0); return }
    const n = Number(text)
    if (!isNaN(n)) onChange(Math.min(max, Math.max(0, n)))
  }

  return (
    <div className="card w-full" id="score-filter-card">
      <label
        htmlFor="min-total-input"
        className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3"
      >
        Min Total Score
      </label>

      <input
        id="min-total-input"
        type="number"
        min={0}
        max={max}
        step={1}
        value={raw}
        placeholder="0"
        onChange={handleChange}
        className="w-full text-4xl font-black text-slate-900 tabular-nums bg-transparent
          border-b-2 border-surface-300 focus:border-brand-500 outline-none
          transition-colors duration-150 pb-1 [appearance:textfield]
          [&::-webkit-outer-spin-button]:appearance-none
          [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Minimum total score filter"
      />

      <p className="text-[10px] text-slate-400 mt-2 font-medium">
        Enter a value between 0 – {max}
      </p>
    </div>
  )
}

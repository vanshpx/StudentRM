export default function ExportButton({ minTotal }) {
  const href = `/api/export?min_total=${encodeURIComponent(minTotal)}`

  return (
    <a
      id="export-button"
      href={href}
      download="shortlist.csv"
      className="btn-primary no-underline"
      aria-label={`Export shortlist as CSV with minimum total score of ${minTotal}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Export Shortlist (CSV)
    </a>
  )
}

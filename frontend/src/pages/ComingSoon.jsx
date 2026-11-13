export default function ComingSoon({ title }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-10 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">This screen is coming soon.</p>
    </div>
  )
}
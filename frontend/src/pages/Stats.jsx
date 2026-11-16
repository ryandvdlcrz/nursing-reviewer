import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function AccuracyBar({ accuracy }) {
  if (accuracy === null) {
    return <div className="h-2 rounded-full bg-surface-2" />
  }
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-label="Accuracy"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(accuracy)}
    >
      <div
        className={`h-full rounded-full ${accuracy < 60 ? 'bg-warn' : 'bg-brand'}`}
        style={{ width: `${accuracy}%` }}
      />
    </div>
  )
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function Stats() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([api('/stats/subjects'), api('/stats/weak'), api('/stats/recent')])
      .then(([subjects, weak, recent]) => {
        if (!active) return
        setData({ subjects, weak, recent })
        setError('')
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const totals = useMemo(() => {
    const subjects = data?.subjects ?? []
    const answered = subjects.reduce((sum, s) => sum + s.answered, 0)
    const correct = subjects.reduce((sum, s) => sum + s.correct, 0)
    const due = subjects.reduce((sum, s) => sum + s.due_cards, 0)
    return {
      answered,
      due,
      accuracy: answered ? Math.round((correct / answered) * 1000) / 10 : null,
    }
  }, [data])

  let body
  if (error) {
    body = (
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold">Could not load your stats</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-strong"
        >
          Try again
        </button>
      </div>
    )
  } else if (data === null) {
    body = (
      <div className="mt-6 space-y-4">
        <div className="h-28 animate-pulse rounded-2xl border border-line bg-surface" />
        <div className="h-48 animate-pulse rounded-2xl border border-line bg-surface" />
      </div>
    )
  } else if (data.subjects.length === 0) {
    body = (
      <div className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="font-semibold">No stats yet</p>
        <p className="mt-1 text-sm text-muted">
          Create a subject and take a quiz, and your progress will show up here.
        </p>
      </div>
    )
  } else {
    const chronological = [...data.recent].reverse()
    const focus = data.weak.filter((subject) => subject.accuracy < 80)

    body = (
      <>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Overall accuracy"
            value={totals.accuracy === null ? 'None yet' : `${totals.accuracy}%`}
            hint="From quiz and mock exam answers"
          />
          <StatCard
            label="Questions answered"
            value={totals.answered}
            hint="Across all subjects"
          />
          <StatCard
            label="Cards due today"
            value={totals.due}
            hint="Ready to study now"
          />
        </div>

        <Section title="Your progress over time">
          {chronological.length === 0 ? (
            <p className="text-sm text-muted">
              Finish a quiz or mock exam, and your scores will show up here.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                {chronological.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1"
                  >
                    <div className="flex h-28 w-full items-end">
                      <div
                        className="w-full rounded-t-md bg-brand"
                        style={{ height: `${Math.max(attempt.percent, 2)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted">
                      {Math.round(attempt.percent)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                Score (%) of your last {plural(chronological.length, 'attempt')},
                oldest on the left.
              </p>
            </>
          )}
        </Section>

        <Section title="Accuracy by subject">
          <div className="space-y-4">
            {data.subjects.map((subject) => (
              <div key={subject.subject_id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold">{subject.name}</span>
                  <span className="shrink-0 text-muted">
                    {subject.accuracy === null
                      ? 'No answers yet'
                      : `${subject.accuracy}% (${subject.correct} of ${subject.answered})`}
                  </span>
                </div>
                <div className="mt-1.5">
                  <AccuracyBar accuracy={subject.accuracy} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Areas to focus on">
          {data.weak.length === 0 ? (
            <p className="text-sm text-muted">
              Answer at least 5 questions in a subject, and it can show up here.
            </p>
          ) : focus.length === 0 ? (
            <p className="text-sm text-muted">
              No weak spots right now. Every subject you practiced is at 80% or higher.
            </p>
          ) : (
            <ul className="space-y-3">
              {focus.map((subject) => (
                <li
                  key={subject.subject_id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3"
                >
                  <span className="min-w-0 truncate font-semibold">{subject.name}</span>
                  <span className="shrink-0 text-sm font-semibold text-warn">
                    {subject.accuracy}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent attempts">
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted">No finished quizzes or exams yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recent.map((attempt) => (
                <li
                  key={attempt.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {attempt.mode === 'mock' ? 'Mock exam' : 'Quiz'}
                    </p>
                    <p className="text-xs text-muted">{formatWhen(attempt.finished_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold">{Math.round(attempt.percent)}%</p>
                    <p className="text-xs text-muted">
                      {attempt.score} of {attempt.total}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold sm:text-3xl">Stats</h1>
      <p className="mt-1 text-muted">See how you are doing and where to focus.</p>
      {body}
    </div>
  )
}
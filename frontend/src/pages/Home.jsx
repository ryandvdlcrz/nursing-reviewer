import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import Icon from '../components/Icon'

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

function AccuracyBar({ accuracy, answered }) {
  if (accuracy === null) {
    return (
      <div>
        <div className="h-2 rounded-full bg-surface-2" />
        <p className="mt-1.5 text-xs text-muted">No quiz answers yet</p>
      </div>
    )
  }
  const low = accuracy < 60
  return (
    <div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label="Accuracy"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(accuracy)}
      >
        <div
          className={`h-full rounded-full ${low ? 'bg-warn' : 'bg-brand'}`}
          style={{ width: `${accuracy}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {accuracy}% accuracy · {answered} answered
      </p>
    </div>
  )
}

function SubjectCard({ subject }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{subject.name}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {plural(subject.cards, 'card')} · {plural(subject.questions, 'question')}
          </p>
        </div>
        {subject.due_cards > 0 && (
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-strong">
            {subject.due_cards} due
          </span>
        )}
      </div>
      <div className="mt-4">
        <AccuracyBar accuracy={subject.accuracy} answered={subject.answered} />
      </div>
    </article>
  )
}

export default function Home() {
  const [subjects, setSubjects] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    api('/stats/subjects')
      .then((data) => {
        if (!active) return
        setSubjects(data)
        setError('')
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const reload = () => setReloadKey((key) => key + 1)

  const totalDue = useMemo(
    () => (subjects ?? []).reduce((sum, s) => sum + s.due_cards, 0),
    [subjects],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (subjects ?? []).filter((s) => s.name.toLowerCase().includes(needle))
  }, [subjects, query])

  async function addSubject(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || saving) return

    setSaving(true)
    setFormError('')
    try {
      await api('/subjects', { method: 'POST', body: { name: trimmed } })
      setName('')
      setAdding(false)
      reload()
    } catch (err) {
      setFormError(
        err.status === 409
          ? 'You already have a subject with that name.'
          : err.message,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">Hi, Thaling</h1>
      <p className="mt-1 text-muted">Here is your day at a glance.</p>

      <section className="mt-6 rounded-3xl bg-brand p-6 text-on-brand sm:p-8">
        <p className="text-sm font-semibold opacity-90">Today</p>
        <p className="mt-1 text-3xl font-bold">
          {subjects === null
            ? '...'
            : totalDue > 0
              ? `${plural(totalDue, 'card')} due`
              : 'You are all caught up'}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/study"
            className="rounded-xl bg-on-brand px-5 py-3 text-sm font-semibold text-brand transition hover:opacity-90"
          >
            Start studying
          </Link>
          <Link
            to="/mock"
            className="flex items-center gap-2 rounded-xl border border-on-brand/40 px-5 py-3 text-sm font-semibold transition hover:bg-on-brand/10"
          >
            <Icon name="timer" className="size-4" />
            Mock exam
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subjects"
              aria-label="Search subjects"
              className="w-full rounded-xl border border-line bg-surface py-3 pl-12 pr-4 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <button
            type="button"
            onClick={() => setAdding((value) => !value)}
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold text-brand transition hover:bg-surface-2"
          >
            <Icon name="plus" className="size-4" />
            New subject
          </button>
        </div>

        {adding && (
          <form
            onSubmit={addSubject}
            className="mt-3 rounded-2xl border border-line bg-surface p-4"
          >
            <label htmlFor="subject-name" className="block text-sm font-semibold">
              Subject name
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="subject-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                placeholder="For example: Pharmacology"
                className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <button
                type="submit"
                disabled={!name.trim() || saving}
                className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-on-brand transition hover:bg-brand-strong disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {formError && (
              <p role="alert" className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                {formError}
              </p>
            )}
          </form>
        )}

        <div className="mt-5">
          {error ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center">
              <p className="font-semibold">Could not load your subjects</p>
              <p className="mt-1 text-sm text-muted">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-strong"
              >
                Try again
              </button>
            </div>
          ) : subjects === null ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-32 animate-pulse rounded-2xl border border-line bg-surface"
                />
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center">
              <p className="font-semibold">No subjects yet</p>
              <p className="mt-1 text-sm text-muted">
                Tap New subject to add your first one.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-muted">
              No subject matches your search.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((subject) => (
                <SubjectCard key={subject.subject_id} subject={subject} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
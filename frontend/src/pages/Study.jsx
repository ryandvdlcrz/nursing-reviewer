import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'
import Icon from '../components/Icon'
import NotesPanel from '../components/NotesPanel'

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

const RATINGS = [
  {
    value: 'again',
    label: 'Again',
    key: '1',
    style: 'border border-warn text-warn hover:bg-surface-2',
  },
  {
    value: 'good',
    label: 'Good',
    key: '2',
    style: 'bg-brand text-on-brand hover:bg-brand-strong',
  },
  {
    value: 'easy',
    label: 'Easy',
    key: '3',
    style: 'border border-brand text-brand hover:bg-surface-2',
  },
]

const EMPTY_TALLY = { again: 0, good: 0, easy: 0 }

export default function Study() {
  const [params, setParams] = useSearchParams()
  const subjectId = params.get('subject') ?? ''

  const [subjects, setSubjects] = useState([])
  const [reloadKey, setReloadKey] = useState(0)
  const [load, setLoad] = useState({ key: '', data: null, error: '' })
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tally, setTally] = useState(EMPTY_TALLY)
  const [bookmarked, setBookmarked] = useState({})
  const [actionError, setActionError] = useState('')

  const key = `${subjectId}|${reloadKey}`
  const loading = load.key !== key
  const cards = load.data?.cards ?? []
  const card = cards[index]
  const isBookmarked = card ? (bookmarked[card.id] ?? card.bookmarked) : false

  useEffect(() => {
    let active = true
    api('/subjects')
      .then((list) => {
        if (active) setSubjects(list)
      })
      .catch(() => {
        // the filter is optional, the study session still works without it
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({ limit: '20' })
    if (subjectId) query.set('subject_id', subjectId)

    api(`/study/due?${query}`)
      .then((data) => {
        if (!active) return
        setLoad({ key, data, error: '' })
        setIndex(0)
        setFlipped(false)
        setTally(EMPTY_TALLY)
        setBookmarked({})
        setActionError('')
      })
      .catch((err) => {
        if (active) setLoad({ key, data: null, error: err.message })
      })

    return () => {
      active = false
    }
  }, [key, subjectId])

  const rate = useCallback(
    async (rating) => {
      if (!card || !flipped || busy) return
      setBusy(true)
      setActionError('')
      try {
        await api('/study/review', {
          method: 'POST',
          body: { card_id: card.id, rating },
        })
        setTally((current) => ({ ...current, [rating]: current[rating] + 1 }))
        setIndex((current) => current + 1)
        setFlipped(false)
      } catch (err) {
        setActionError(err.message)
      } finally {
        setBusy(false)
      }
    },
    [card, flipped, busy],
  )

  useEffect(() => {
    function onKeyDown(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const tag = event.target.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (!card) return

      if (event.key === ' ' || event.key === 'Enter') {
        if (!flipped) {
          event.preventDefault()
          setFlipped(true)
        }
        return
      }
      if (flipped) {
        const match = RATINGS.find((item) => item.key === event.key)
        if (match) rate(match.value)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [card, flipped, rate])

  async function toggleBookmark() {
    if (!card) return
    const next = !isBookmarked
    setBookmarked((current) => ({ ...current, [card.id]: next }))
    try {
      await api(`/cards/${card.id}`, { method: 'PUT', body: { bookmarked: next } })
    } catch (err) {
      setBookmarked((current) => ({ ...current, [card.id]: !next }))
      setActionError(err.message)
    }
  }

  function changeSubject(value) {
    setParams(value ? { subject: value } : {})
  }

  const done = !loading && load.data && cards.length > 0 && index >= cards.length
  const moreDue = load.data ? load.data.total_due - cards.length : 0

  let body
  if (loading) {
    body = (
      <div className="h-80 animate-pulse rounded-3xl border border-line bg-surface" />
    )
  } else if (load.error) {
    body = (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold">Could not load your cards</p>
        <p className="mt-1 text-sm text-muted">{load.error}</p>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-strong"
        >
          Try again
        </button>
      </div>
    )
  } else if (cards.length === 0) {
    body = (
      <div className="rounded-3xl border border-dashed border-line p-10 text-center">
        <p className="text-xl font-bold">Nothing due right now</p>
        <p className="mt-1 text-muted">
          You are all caught up. New cards will show up here when they are due.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-on-brand hover:bg-brand-strong"
        >
          Back to Home
        </Link>
      </div>
    )
  } else if (done) {
    body = (
      <div className="rounded-3xl border border-line bg-surface p-8 text-center">
        <h2 className="text-2xl font-bold">Session complete</h2>
        <p className="mt-1 text-muted">
          You reviewed {plural(cards.length, 'card')}.
        </p>

        <dl className="mt-6 grid grid-cols-3 gap-3">
          {RATINGS.map((item) => (
            <div key={item.value} className="rounded-2xl bg-surface-2 p-4">
              <dd className="text-2xl font-bold">{tally[item.value]}</dd>
              <dt className="text-sm text-muted">{item.label}</dt>
            </div>
          ))}
        </dl>

        {moreDue > 0 ? (
          <>
            <p className="mt-6 text-sm text-muted">
              {plural(moreDue, 'more card')} {moreDue === 1 ? 'is' : 'are'} still due.
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-3 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-on-brand hover:bg-brand-strong"
            >
              Study more
            </button>
          </>
        ) : (
          <p className="mt-6 text-sm text-muted">
            You are all caught up for today.
          </p>
        )}

        <div className="mt-4">
          <Link to="/" className="text-sm font-semibold text-brand">
            Back to Home
          </Link>
        </div>
      </div>
    )
  } else {
    body = (
      <>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={cards.length}
          aria-valuenow={index}
        >
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${(index / cards.length) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted">
          Card {index + 1} of {cards.length}
        </p>

        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setFlipped(true)}
            aria-label={flipped ? 'Card, answer shown' : 'Show answer'}
            className="block min-h-72 w-full rounded-3xl border border-line bg-surface p-6 text-left shadow-sm sm:p-10"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              Question
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words pr-10 text-xl font-semibold sm:text-2xl">
              {card.front}
            </p>

            {flipped ? (
              <>
                <hr className="my-6 border-line" />
                <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                  Answer
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-lg sm:text-xl">
                  {card.back}
                </p>
              </>
            ) : (
              <p className="mt-8 text-sm text-muted">Tap to show the answer</p>
            )}
          </button>

          <button
            type="button"
            onClick={toggleBookmark}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this card'}
            aria-pressed={isBookmarked}
            className="absolute right-4 top-4 rounded-xl p-2 text-brand transition hover:bg-surface-2"
          >
            <Icon name="bookmark" filled={isBookmarked} />
          </button>
        </div>

        <div className="mt-4">
          {flipped ? (
            <div className="grid grid-cols-3 gap-3">
              {RATINGS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  disabled={busy}
                  onClick={() => rate(item.value)}
                  className={`rounded-xl py-3.5 text-sm font-semibold transition disabled:opacity-60 ${item.style}`}
                >
                  {item.label}
                  <span className="ml-1.5 hidden text-xs opacity-60 md:inline">
                    {item.key}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="w-full rounded-xl bg-brand py-3.5 text-sm font-semibold text-on-brand transition hover:bg-brand-strong"
            >
              Show answer
            </button>
          )}

          {actionError && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
              {actionError}
            </p>
          )}

          <p className="mt-3 hidden text-center text-xs text-muted md:block">
            Space shows the answer. Then press 1 for Again, 2 for Good, 3 for Easy.
          </p>
        </div>

        {flipped && (
          <NotesPanel key={card.id} targetType="card" targetId={card.id} />
        )}
      </>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Study</h1>
          {!loading && load.data && (
            <p className="mt-1 text-sm text-muted">
              {plural(load.data.total_due, 'card')} due
            </p>
          )}
        </div>

        <div>
          <label htmlFor="subject-filter" className="sr-only">
            Subject
          </label>
          <select
            id="subject-filter"
            value={subjectId}
            onChange={(event) => changeSubject(event.target.value)}
            className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6">{body}</div>
    </div>
  )
}
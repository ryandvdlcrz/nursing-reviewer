import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import QuizRunner from '../components/QuizRunner'

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

const COUNTS = {
  quiz: [5, 10, 20],
  mock: [10, 25, 50, 100],
}

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'

export default function Practice({ mode }) {
  const isMock = mode === 'mock'

  const [subjects, setSubjects] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [subjectId, setSubjectId] = useState('')
  const [count, setCount] = useState(isMock ? 25 : 10)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)

  useEffect(() => {
    let active = true
    api('/stats/subjects')
      .then((data) => {
        if (!active) return
        setSubjects(data)
        setLoadError('')
      })
      .catch((err) => {
        if (active) setLoadError(err.message)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const withQuestions = useMemo(
    () => (subjects ?? []).filter((subject) => subject.questions > 0),
    [subjects],
  )
  const totalQuestions = withQuestions.reduce((sum, s) => sum + s.questions, 0)

  const chosenSubject = withQuestions.find((s) => String(s.subject_id) === subjectId)
  const available = isMock || !chosenSubject ? totalQuestions : chosenSubject.questions
  const willGet = Math.min(count, available)

  async function start() {
    if (starting || willGet === 0) return
    setStarting(true)
    setError('')
    try {
      const attempt = await api('/attempts', {
        method: 'POST',
        body: {
          mode,
          subject_id: !isMock && chosenSubject ? chosenSubject.subject_id : null,
          num_questions: count,
        },
      })
      setSession({
        attempt,
        timeLimitSeconds: isMock ? attempt.total * 60 : 0,
        deadline: isMock ? Date.now() + attempt.total * 60 * 1000 : 0,
      })
    } catch (err) {
      setError(
        err.status === 404
          ? 'There are no questions to practice yet. Add some first.'
          : err.message,
      )
    } finally {
      setStarting(false)
    }
  }

  if (session) {
    return (
      <QuizRunner
        key={session.attempt.id}
        attempt={session.attempt}
        mode={mode}
        deadline={session.deadline}
        timeLimitSeconds={session.timeLimitSeconds}
        onExit={() => {
          setSession(null)
          setReloadKey((value) => value + 1)
        }}
      />
    )
  }

  let content
  if (loadError) {
    content = (
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold">Could not load your subjects</p>
        <p className="mt-1 text-sm text-muted">{loadError}</p>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-strong"
        >
          Try again
        </button>
      </div>
    )
  } else if (subjects === null) {
    content = (
      <div className="mt-6 h-64 animate-pulse rounded-3xl border border-line bg-surface" />
    )
  } else if (totalQuestions === 0) {
    content = (
      <div className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="font-semibold">No questions yet</p>
        <p className="mt-1 text-sm text-muted">
          Add multiple-choice questions first, by hand or from a screenshot.
        </p>
        <Link
          to="/add"
          className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-strong"
        >
          Add questions
        </Link>
      </div>
    )
  } else {
    content = (
      <div className="mt-6 space-y-5 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        {isMock ? (
          <div className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">
            <p className="font-semibold text-ink">How the mock exam works</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Random questions from all your subjects.</li>
              <li>You get 1 minute per question, and the exam ends when time runs out.</li>
              <li>You will not see answers until the end.</li>
            </ul>
          </div>
        ) : (
          <div>
            <label htmlFor="quiz-subject" className="block text-sm font-semibold">
              Subject
            </label>
            <select
              id="quiz-subject"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className={`${inputClass} mt-2`}
            >
              <option value="">
                All subjects ({plural(totalQuestions, 'question')})
              </option>
              {withQuestions.map((subject) => (
                <option key={subject.subject_id} value={subject.subject_id}>
                  {subject.name} ({plural(subject.questions, 'question')})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold">Number of questions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COUNTS[mode].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCount(value)}
                aria-pressed={count === value}
                className={`rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${
                  count === value
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-line text-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            You will get {plural(willGet, 'question')}
            {willGet < count ? ` (that is all you have${isMock ? '' : ' here'})` : ''}
            {isMock ? `, with ${plural(willGet, 'minute')} on the clock.` : '.'}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={start}
          disabled={starting || willGet === 0}
          className="w-full rounded-xl bg-brand py-3.5 text-sm font-semibold text-on-brand transition hover:bg-brand-strong disabled:opacity-60"
        >
          {starting ? 'Starting...' : isMock ? 'Start mock exam' : 'Start quiz'}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold sm:text-3xl">
        {isMock ? 'Mock exam' : 'Quiz'}
      </h1>
      <p className="mt-1 text-muted">
        {isMock
          ? 'A timed practice exam across all your subjects.'
          : 'Practice questions and see the rationale after each answer.'}
      </p>
      {content}
    </div>
  )
}
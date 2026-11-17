import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import Icon from './Icon'
import NotesPanel from './NotesPanel'

const LETTERS = 'ABCDEF'
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

const primaryButton =
  'rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-on-brand transition hover:bg-brand-strong disabled:opacity-60'
const secondaryButton =
  'rounded-xl border border-line px-5 py-3 text-sm font-semibold text-brand transition hover:bg-surface-2 disabled:opacity-60'

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function Results({ result, questions, answers, timeUp, onExit }) {
  const answered = result.breakdown.reduce((sum, row) => sum + row.answered, 0)
  const notAnswered = Math.max(result.total - answered, 0)
  const missed = questions.filter(
    (question) => answers[question.id] && answers[question.id].is_correct === false,
  )

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl bg-brand p-6 text-center text-on-brand sm:p-8">
        <p className="text-sm font-semibold opacity-90">
          {result.mode === 'mock' ? 'Mock exam' : 'Quiz'} result
        </p>
        <p className="mt-1 text-5xl font-bold">{result.percent}%</p>
        <p className="mt-1 text-lg font-semibold">
          {result.score} of {result.total} correct
        </p>
        {timeUp && <p className="mt-2 text-sm opacity-90">Time ran out.</p>}
        {notAnswered > 0 && (
          <p className="mt-2 text-sm opacity-90">
            {plural(notAnswered, 'question')} not answered (counted as wrong)
          </p>
        )}
      </div>

      {result.breakdown.length > 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-bold">By subject</h2>
          <div className="mt-4 space-y-4">
            {result.breakdown.map((row) => {
              const accuracy = row.answered
                ? Math.round((row.correct / row.answered) * 100)
                : 0
              return (
                <div key={row.subject_id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold">
                      {row.subject_name}
                    </span>
                    <span className="shrink-0 text-muted">
                      {row.correct} of {row.answered} ({accuracy}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${accuracy < 60 ? 'bg-warn' : 'bg-brand'}`}
                      style={{ width: `${accuracy}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-bold">Questions to review</h2>
        {missed.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {answered === 0
              ? 'You did not answer any questions.'
              : 'You got every answered question right.'}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {missed.map((question) => {
              const answer = answers[question.id]
              return (
                <article
                  key={question.id}
                  className="rounded-2xl border border-line bg-surface p-5"
                >
                  <p className="whitespace-pre-wrap break-words font-semibold">
                    {question.question}
                  </p>
                  <p className="mt-3 text-sm">
                    <span className="font-semibold text-warn">Your answer: </span>
                    {question.choices[answer.chosen]}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-semibold text-brand-strong">Correct answer: </span>
                    {question.choices[answer.correct_index]}
                  </p>
                  {answer.rationale && (
                    <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-3 text-sm text-muted">
                      {answer.rationale}
                    </p>
                  )}
                  <NotesPanel targetType="question" targetId={question.id} />
                </article>
              )
            })}
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onExit} className={primaryButton}>
          Practice again
        </button>
        <Link to="/" className={secondaryButton}>
          Back to Home
        </Link>
      </div>
    </div>
  )
}

export default function QuizRunner({
  attempt,
  mode,
  deadline,
  timeLimitSeconds,
  onExit,
}) {
  const timed = mode === 'mock'
  const questions = attempt.questions

  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [remaining, setRemaining] = useState(timeLimitSeconds)
  const [timeUp, setTimeUp] = useState(false)
  const [bookmarks, setBookmarks] = useState({})
  const timeUpRef = useRef(null)

  const question = questions[index]
  const answer = answers[question.id]
  const isLast = index + 1 >= questions.length
  const showFeedback = mode === 'quiz' && Boolean(answer)
  const isBookmarked = bookmarks[question.id] ?? question.bookmarked

  async function finish() {
    setBusy(true)
    setError('')
    try {
      const data = await api(`/attempts/${attempt.id}/finish`, { method: 'POST' })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function advance() {
    if (isLast) {
      await finish()
      return
    }
    setIndex((current) => current + 1)
    setSelected(null)
    setError('')
  }

  async function confirmChoice() {
    if (selected === null || busy) return
    setBusy(true)
    setError('')
    try {
      const data = await api(`/attempts/${attempt.id}/answer`, {
        method: 'POST',
        body: { question_id: question.id, chosen_index: selected },
      })
      setAnswers((current) => ({
        ...current,
        [question.id]: { chosen: selected, ...data },
      }))
      if (mode === 'mock') await advance()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleTimeUp() {
    setTimeUp(true)
    if (selected !== null && !answers[question.id]) {
      try {
        await api(`/attempts/${attempt.id}/answer`, {
          method: 'POST',
          body: { question_id: question.id, chosen_index: selected },
        })
      } catch {
        // the pending answer is lost if this fails, the exam still gets finished
      }
    }
    await finish()
  }

  useEffect(() => {
    timeUpRef.current = handleTimeUp
  })

  useEffect(() => {
    if (!timed || result) return
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) {
        clearInterval(timer)
        timeUpRef.current?.()
      }
    }, 500)
    return () => clearInterval(timer)
  }, [timed, deadline, result])

  function endEarly() {
    const ok = window.confirm(
      'End now? Questions you have not answered will count as wrong.',
    )
    if (ok) finish()
  }

  async function toggleBookmark() {
    const next = !isBookmarked
    setBookmarks((current) => ({ ...current, [question.id]: next }))
    try {
      await api(`/questions/${question.id}`, {
        method: 'PUT',
        body: { bookmarked: next },
      })
    } catch (err) {
      setBookmarks((current) => ({ ...current, [question.id]: !next }))
      setError(err.message)
    }
  }

  if (result) {
    return (
      <Results
        result={result}
        questions={questions}
        answers={answers}
        timeUp={timeUp}
        onExit={onExit}
      />
    )
  }

  if (timeUp) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-surface p-8 text-center">
        <h1 className="text-2xl font-bold">Time is up</h1>
        <p className="mt-2 text-muted">
          {busy ? 'Finishing your exam...' : 'We could not finish your exam yet.'}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {!busy && (
          <button type="button" onClick={finish} className={`${primaryButton} mt-5`}>
            Try again
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted">
          Question {index + 1} of {questions.length}
        </p>
        <div className="flex items-center gap-3">
          {timed && (
            <p
              role="timer"
              className={`flex items-center gap-1.5 text-sm font-bold tabular-nums ${
                remaining <= 60 ? 'text-warn' : 'text-ink'
              }`}
            >
              <Icon name="timer" className="size-4" />
              {formatTime(remaining)}
            </p>
          )}
          <button
            type="button"
            onClick={endEarly}
            disabled={busy}
            className="text-sm font-semibold text-brand disabled:opacity-60"
          >
            {mode === 'mock' ? 'End exam' : 'End quiz'}
          </button>
        </div>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={index}
      >
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${(index / questions.length) * 100}%` }}
        />
      </div>

      <div className="relative mt-5 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <p className="whitespace-pre-wrap break-words pr-10 text-lg font-semibold sm:text-xl">
          {question.question}
        </p>
        <button
          type="button"
          onClick={toggleBookmark}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this question'}
          aria-pressed={isBookmarked}
          className="absolute right-4 top-4 rounded-xl p-2 text-brand transition hover:bg-surface-2"
        >
          <Icon name="bookmark" filled={isBookmarked} />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {question.choices.map((choice, i) => {
          const isSelected = selected === i
          const isCorrect = showFeedback && answer.correct_index === i
          const isWrongPick = showFeedback && answer.chosen === i && !answer.is_correct

          let style = 'border-line bg-surface hover:bg-surface-2'
          if (showFeedback) {
            if (isCorrect) style = 'border-brand bg-surface-2'
            else if (isWrongPick) style = 'border-warn bg-surface-2'
            else style = 'border-line bg-surface opacity-60'
          } else if (isSelected) {
            style = 'border-brand bg-surface-2 ring-2 ring-brand/30'
          }

          return (
            <button
              key={i}
              type="button"
              disabled={showFeedback || busy}
              onClick={() => setSelected(i)}
              aria-pressed={isSelected}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${style}`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-brand-strong">
                {LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pt-0.5">
                {choice}
              </span>
              {isCorrect && (
                <span className="shrink-0 pt-1 text-xs font-semibold text-brand-strong">
                  Correct
                </span>
              )}
              {isWrongPick && (
                <span className="shrink-0 pt-1 text-xs font-semibold text-warn">
                  Your answer
                </span>
              )}
            </button>
          )
        })}
      </div>

      {showFeedback && (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-line bg-surface-2 p-4 text-sm"
        >
          <p className="font-bold">{answer.is_correct ? 'Correct!' : 'Not quite.'}</p>
          {answer.rationale && (
            <p className="mt-1 whitespace-pre-wrap break-words text-muted">
              {answer.rationale}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {mode === 'quiz' && !answer && (
          <button
            type="button"
            onClick={confirmChoice}
            disabled={selected === null || busy}
            className={primaryButton}
          >
            {busy ? 'Checking...' : 'Check answer'}
          </button>
        )}
        {mode === 'quiz' && answer && (
          <button type="button" onClick={advance} disabled={busy} className={primaryButton}>
            {isLast ? 'See results' : 'Next question'}
          </button>
        )}
        {mode === 'mock' && (
          <>
            <button
              type="button"
              onClick={confirmChoice}
              disabled={selected === null || busy}
              className={primaryButton}
            >
              {busy ? 'Saving...' : isLast ? 'Finish exam' : 'Next'}
            </button>
            <button
              type="button"
              onClick={advance}
              disabled={busy}
              className={secondaryButton}
            >
              {isLast ? 'Skip and finish' : 'Skip'}
            </button>
          </>
        )}
      </div>

      {showFeedback && (
        <NotesPanel key={question.id} targetType="question" targetId={question.id} />
      )}
    </div>
  )
}
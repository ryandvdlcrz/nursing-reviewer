import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'
import ScreenshotTab from '../components/ScreenshotTab'

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'
const labelClass = 'block text-sm font-semibold'
const primaryButton =
  'rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-on-brand transition hover:bg-brand-strong disabled:opacity-60'

const TABS = [
  { id: 'card', label: 'Card' },
  { id: 'question', label: 'Question' },
  { id: 'screenshot', label: 'Screenshot' },
]

function Notice({ added, noun }) {
  if (added === 0) return null
  return (
    <p role="status" className="text-sm font-medium text-brand-strong">
      Saved. {plural(added, noun)} added in this session.
    </p>
  )
}

function ErrorText({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
      {message}
    </p>
  )
}

function CardForm({ subjectId }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(0)
  const frontRef = useRef(null)

  const canSave = Boolean(subjectId) && front.trim() && back.trim() && !saving

  async function submit(event) {
    event.preventDefault()
    if (!canSave) return

    setSaving(true)
    setError('')
    try {
      await api('/cards', {
        method: 'POST',
        body: {
          subject_id: Number(subjectId),
          front: front.trim(),
          back: back.trim(),
        },
      })
      setFront('')
      setBack('')
      setAdded((count) => count + 1)
      frontRef.current?.focus()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event)
  }

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown} className="mt-5 space-y-5">
      <div>
        <label htmlFor="card-front" className={labelClass}>
          Front (question or term)
        </label>
        <textarea
          id="card-front"
          ref={frontRef}
          value={front}
          onChange={(event) => setFront(event.target.value)}
          rows={3}
          placeholder="For example: Antidote for heparin?"
          className={`${inputClass} mt-2`}
        />
      </div>

      <div>
        <label htmlFor="card-back" className={labelClass}>
          Back (answer)
        </label>
        <textarea
          id="card-back"
          value={back}
          onChange={(event) => setBack(event.target.value)}
          rows={4}
          placeholder="For example: Protamine sulfate"
          className={`${inputClass} mt-2`}
        />
      </div>

      <ErrorText message={error} />
      <Notice added={added} noun="card" />

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!canSave} className={primaryButton}>
          {saving ? 'Saving...' : 'Save card'}
        </button>
        <span className="hidden text-xs text-muted md:inline">Ctrl + Enter to save</span>
      </div>
    </form>
  )
}

const MIN_CHOICES = 2
const MAX_CHOICES = 6
const LETTERS = 'ABCDEF'

function QuestionForm({ subjectId }) {
  const [question, setQuestion] = useState('')
  const [choices, setChoices] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState(null)
  const [rationale, setRationale] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(0)
  const questionRef = useRef(null)

  const canSave =
    Boolean(subjectId) &&
    question.trim() &&
    choices.every((choice) => choice.trim()) &&
    correct !== null &&
    !saving

  function updateChoice(index, value) {
    setChoices((current) =>
      current.map((choice, i) => (i === index ? value : choice)),
    )
  }

  function addChoice() {
    setChoices((current) =>
      current.length < MAX_CHOICES ? [...current, ''] : current,
    )
  }

  function removeChoice(index) {
    setChoices((current) => current.filter((_, i) => i !== index))
    setCorrect((current) => {
      if (current === null || current === index) return null
      return current > index ? current - 1 : current
    })
  }

  async function submit(event) {
    event.preventDefault()
    if (!canSave) return

    const cleaned = choices.map((choice) => choice.trim())
    if (new Set(cleaned.map((choice) => choice.toLowerCase())).size !== cleaned.length) {
      setError('Two of the choices are the same. Please make each one different.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await api('/questions', {
        method: 'POST',
        body: {
          subject_id: Number(subjectId),
          question: question.trim(),
          choices: cleaned,
          correct_index: correct,
          rationale: rationale.trim() || null,
          source: 'manual',
        },
      })
      setQuestion('')
      setChoices(['', '', '', ''])
      setCorrect(null)
      setRationale('')
      setAdded((count) => count + 1)
      questionRef.current?.focus()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event)
  }

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown} className="mt-5 space-y-5">
      <div>
        <label htmlFor="question-text" className={labelClass}>
          Question
        </label>
        <textarea
          id="question-text"
          ref={questionRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          placeholder="Type the question"
          className={`${inputClass} mt-2`}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>Choices</legend>
        <p className="mt-1 text-xs text-muted">
          Select the circle next to the correct answer.
        </p>
        <div className="mt-3 space-y-3">
          {choices.map((choice, index) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="radio"
                name="correct-choice"
                checked={correct === index}
                onChange={() => setCorrect(index)}
                aria-label={`Mark choice ${LETTERS[index]} as correct`}
                className="size-5 shrink-0 accent-brand"
              />
              <span className="w-5 shrink-0 text-sm font-semibold text-muted">
                {LETTERS[index]}
              </span>
              <input
                value={choice}
                onChange={(event) => updateChoice(index, event.target.value)}
                placeholder={`Choice ${LETTERS[index]}`}
                aria-label={`Choice ${LETTERS[index]}`}
                className={inputClass}
              />
              {choices.length > MIN_CHOICES && (
                <button
                  type="button"
                  onClick={() => removeChoice(index)}
                  aria-label={`Remove choice ${LETTERS[index]}`}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-xl leading-none text-muted hover:bg-surface-2 hover:text-ink"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {choices.length < MAX_CHOICES && (
          <button
            type="button"
            onClick={addChoice}
            className="mt-3 text-sm font-semibold text-brand"
          >
            + Add another choice
          </button>
        )}
      </fieldset>

      <div>
        <label htmlFor="question-rationale" className={labelClass}>
          Rationale <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="question-rationale"
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          rows={3}
          placeholder="Why is this the correct answer?"
          className={`${inputClass} mt-2`}
        />
      </div>

      <ErrorText message={error} />
      <Notice added={added} noun="question" />

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!canSave} className={primaryButton}>
          {saving ? 'Saving...' : 'Save question'}
        </button>
        <span className="hidden text-xs text-muted md:inline">Ctrl + Enter to save</span>
      </div>
    </form>
  )
}

export default function Add() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState('card')
  const [subjects, setSubjects] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [subjectId, setSubjectId] = useState(() => params.get('subject') ?? '')

  useEffect(() => {
    let active = true
    api('/subjects')
      .then((list) => {
        if (!active) return
        setSubjects(list)
        setLoadError('')
      })
      .catch((err) => {
        if (active) setLoadError(err.message)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const candidate = subjectId || (subjects?.length === 1 ? String(subjects[0].id) : '')
  const selected = subjects?.some((s) => String(s.id) === candidate) ? candidate : ''

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
  } else if (subjects.length === 0) {
    content = (
      <div className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="font-semibold">Create a subject first</p>
        <p className="mt-1 text-sm text-muted">
          Cards and questions belong to a subject, like Pharmacology.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-strong"
        >
          Go to Home
        </Link>
      </div>
    )
  } else {
    content = (
      <>
        <div className="mt-6">
          <label htmlFor="add-subject" className={labelClass}>
            Subject
          </label>
          <select
            id="add-subject"
            value={selected}
            onChange={(event) => setSubjectId(event.target.value)}
            className={`${inputClass} mt-2`}
          >
            <option value="">Choose a subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                tab === item.id ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div hidden={tab !== 'card'}>
          <CardForm subjectId={selected} />
        </div>
        <div hidden={tab !== 'question'}>
          <QuestionForm subjectId={selected} />
        </div>
        <div hidden={tab !== 'screenshot'}>
          <ScreenshotTab subjectId={selected} />
        </div>
      </>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold sm:text-3xl">Add content</h1>
      <p className="mt-1 text-muted">Add cards and questions to your subjects.</p>
      {content}
    </div>
  )
}
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { prepareImage } from '../utils/image'

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'
const labelClass = 'block text-sm font-semibold'
const primaryButton =
  'rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-on-brand transition hover:bg-brand-strong disabled:opacity-60'

const LETTERS = 'ABCDEF'
const COUNTS = [3, 5, 8, 10]
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

let nextDraftId = 1

function toDraft(raw) {
  return {
    id: nextDraftId++,
    question: raw.question,
    choices: raw.choices,
    correct: raw.correct_index,
    rationale: raw.rationale ?? '',
  }
}

function validate(draft) {
  if (!draft.question.trim()) return 'The question is empty.'
  const emptyIndex = draft.choices.findIndex((choice) => !choice.trim())
  if (emptyIndex !== -1) return `Choice ${LETTERS[emptyIndex]} is empty.`
  const lowered = draft.choices.map((choice) => choice.trim().toLowerCase())
  if (new Set(lowered).size !== lowered.length) return 'Two choices are the same.'
  if (draft.correct === null || draft.correct >= draft.choices.length) {
    return 'Mark the correct answer.'
  }
  return ''
}

export default function ScreenshotTab({ subjectId }) {
  const [image, setImage] = useState(null)
  const [count, setCount] = useState(5)
  const [usage, setUsage] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const urlRef = useRef(null)

  useEffect(() => {
    let active = true
    api('/generate/usage')
      .then((data) => {
        if (active) setUsage(data)
      })
      .catch(() => {
        // usage is only informational, generating still works without it
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  async function onPick(event) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return

    setError('')
    if (!picked.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }

    try {
      const prepared = await prepareImage(picked)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = URL.createObjectURL(prepared)
      urlRef.current = url
      setImage({ file: prepared, url })
    } catch (err) {
      setError(err.message)
    }
  }

  async function generate() {
    if (!image || generating) return

    setGenerating(true)
    setError('')
    setSaveError('')
    setSavedCount(0)
    try {
      const form = new FormData()
      form.append('file', image.file)
      form.append('num_questions', String(count))
      const data = await api('/generate/from-image', { method: 'POST', body: form })
      setUsage(data.usage)
      setDrafts(data.drafts.map(toDraft))
    } catch (err) {
      setError(err.message)
      if (err.status === 429) {
        api('/generate/usage')
          .then(setUsage)
          .catch(() => {})
      }
    } finally {
      setGenerating(false)
    }
  }

  function updateDraft(id, patch) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    )
  }

  function updateChoice(id, index, value) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              choices: draft.choices.map((choice, i) => (i === index ? value : choice)),
            }
          : draft,
      ),
    )
  }

  function removeDraft(id) {
    setDrafts((current) => current.filter((draft) => draft.id !== id))
  }

  function startOver() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setImage(null)
    setDrafts(null)
    setError('')
    setSaveError('')
    setSavedCount(0)
  }

  async function saveAll() {
    if (!subjectId || saving || !drafts || drafts.length === 0) return

    setSaving(true)
    setSaveError('')
    const remaining = [...drafts]
    let saved = 0
    try {
      for (const draft of drafts) {
        await api('/questions', {
          method: 'POST',
          body: {
            subject_id: Number(subjectId),
            question: draft.question.trim(),
            choices: draft.choices.map((choice) => choice.trim()),
            correct_index: draft.correct,
            rationale: draft.rationale.trim() || null,
            source: 'ai',
          },
        })
        saved += 1
        remaining.shift()
      }
    } catch (err) {
      setSaveError(
        `${err.message}. ${plural(saved, 'question')} saved so far, the rest are still here.`,
      )
    } finally {
      setDrafts(remaining)
      setSavedCount((current) => current + saved)
      setSaving(false)
    }
  }

  const limitReached = usage !== null && usage.remaining <= 0
  const problems = drafts ? drafts.map(validate) : []
  const hasProblems = problems.some(Boolean)

  if (drafts === null) {
    return (
      <div className="mt-5 space-y-5">
        <div className="rounded-2xl border border-line bg-surface-2 p-4 text-sm text-muted">
          <p className="font-semibold text-ink">For the best results</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Use a clear, cropped screenshot with one topic.</li>
            <li>Busy slides with lots of small text give weaker questions.</li>
            <li>Do not upload anything with personal information.</li>
          </ul>
        </div>

        {image ? (
          <div>
            <img
              src={image.url}
              alt="Your selected screenshot"
              className="max-h-80 w-full rounded-2xl border border-line object-contain bg-surface"
            />
            <label className="mt-3 inline-block cursor-pointer text-sm font-semibold text-brand">
              Choose a different image
              <input type="file" accept="image/*" onChange={onPick} className="sr-only" />
            </label>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-line p-10 text-center transition hover:bg-surface-2">
            <span className="text-base font-semibold text-brand">
              Choose a screenshot or photo
            </span>
            <span className="mt-1 text-sm text-muted">
              From your gallery or camera
            </span>
            <input type="file" accept="image/*" onChange={onPick} className="sr-only" />
          </label>
        )}

        <div>
          <label htmlFor="question-count" className={labelClass}>
            How many questions?
          </label>
          <select
            id="question-count"
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className={`${inputClass} mt-2`}
          >
            {COUNTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={generate}
            disabled={!image || generating || limitReached}
            className={`${primaryButton} w-full`}
          >
            {generating ? 'Reading your image...' : 'Generate questions'}
          </button>
          {generating && (
            <p className="mt-2 text-center text-xs text-muted">
              This can take up to a minute if the server is waking up.
            </p>
          )}
          {usage && (
            <p className="mt-2 text-center text-xs text-muted">
              {limitReached
                ? 'You reached today\'s limit. It resets at midnight.'
                : `${usage.remaining} of ${usage.limit} generations left today`}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 space-y-5">
      {image && (
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3">
          <img
            src={image.url}
            alt="The image the questions came from"
            className="size-20 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">Your image</p>
            <a
              href={image.url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand"
            >
              Open full size
            </a>
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="rounded-2xl border border-warn/50 bg-surface-2 p-4 text-sm">
          <p className="font-semibold">Check every answer before saving</p>
          <p className="mt-1 text-muted">
            The AI can make mistakes. Compare each question and answer with your
            notes, edit anything that is wrong, and remove drafts you do not want.
          </p>
        </div>
      )}

      {savedCount > 0 && (
        <p role="status" className="text-sm font-medium text-brand-strong">
          Saved. {plural(savedCount, 'question')} added to this subject.
        </p>
      )}

      {drafts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="font-semibold">
            {savedCount > 0 ? 'All done' : 'No questions to review'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {savedCount > 0
              ? 'You can add another image.'
              : 'Nothing usable came from this image. Try a clearer, closer screenshot of one topic.'}
          </p>
        </div>
      ) : (
        drafts.map((draft, position) => (
          <article
            key={draft.id}
            className="rounded-2xl border border-line bg-surface p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Question {position + 1}</h3>
              <button
                type="button"
                onClick={() => removeDraft(draft.id)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink"
              >
                Remove
              </button>
            </div>

            <textarea
              value={draft.question}
              onChange={(event) => updateDraft(draft.id, { question: event.target.value })}
              rows={3}
              aria-label={`Question ${position + 1} text`}
              className={`${inputClass} mt-3`}
            />

            <div className="mt-4 space-y-3">
              {draft.choices.map((choice, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`correct-${draft.id}`}
                    checked={draft.correct === index}
                    onChange={() => updateDraft(draft.id, { correct: index })}
                    aria-label={`Mark choice ${LETTERS[index]} as correct`}
                    className="size-5 shrink-0 accent-brand"
                  />
                  <span className="w-5 shrink-0 text-sm font-semibold text-muted">
                    {LETTERS[index]}
                  </span>
                  <input
                    value={choice}
                    onChange={(event) => updateChoice(draft.id, index, event.target.value)}
                    aria-label={`Choice ${LETTERS[index]}`}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>

            <label htmlFor={`rationale-${draft.id}`} className={`${labelClass} mt-4`}>
              Rationale
            </label>
            <textarea
              id={`rationale-${draft.id}`}
              value={draft.rationale}
              onChange={(event) => updateDraft(draft.id, { rationale: event.target.value })}
              rows={2}
              className={`${inputClass} mt-2`}
            />

            {problems[position] && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                {problems[position]}
              </p>
            )}
          </article>
        ))
      )}

      {saveError && (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {saveError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {drafts.length > 0 && (
          <button
            type="button"
            onClick={saveAll}
            disabled={!subjectId || hasProblems || saving}
            className={primaryButton}
          >
            {saving ? 'Saving...' : `Save ${plural(drafts.length, 'question')}`}
          </button>
        )}
        <button
          type="button"
          onClick={startOver}
          className="rounded-xl border border-line px-5 py-3 text-sm font-semibold text-brand transition hover:bg-surface-2"
        >
          {drafts.length === 0 ? 'Add another image' : 'Start over'}
        </button>
      </div>
      {drafts.length > 0 && !subjectId && (
        <p className="text-xs text-muted">Choose a subject at the top to save.</p>
      )}
    </div>
  )
}
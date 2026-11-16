import { useState } from 'react'
import { useOutletContext } from 'react-router'
import { api } from '../api'

const ACTIONS = {
  quiz: {
    scope: 'quiz',
    button: 'Reset quiz and exam progress',
    title: 'Reset quiz and exam progress?',
    detail:
      'This deletes all quiz and mock exam results. Every subject goes back to "No quiz answers yet", and your recent attempts are cleared. Your cards, questions, notes, and bookmarks stay.',
    done: (result) =>
      `Done. ${result.attempts_deleted} ${
        result.attempts_deleted === 1 ? 'attempt' : 'attempts'
      } cleared. Every subject is back to "No quiz answers yet".`,
  },
  cards: {
    scope: 'cards',
    button: 'Reset flashcard schedule',
    title: 'Reset flashcard schedule?',
    detail:
      'Every card becomes new again and is due today, as if you had never studied it. Your cards, notes, and bookmarks stay.',
    done: (result) =>
      `Done. ${result.cards_reset} ${
        result.cards_reset === 1 ? 'card is' : 'cards are'
      } new again and due today.`,
  },
}

export default function Settings() {
  const { theme, setTheme, onLogout } = useOutletContext()
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function runReset(key) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await api('/progress/reset', {
        method: 'POST',
        body: { scope: ACTIONS[key].scope },
      })
      setMessage(ACTIONS[key].done(data))
      setConfirming(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Appearance</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1">
          {['light', 'dark'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTheme(option)}
              aria-pressed={theme === option}
              className={`rounded-lg py-2.5 text-sm font-semibold capitalize transition ${
                theme === option
                  ? 'bg-brand text-on-brand'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Progress</h2>
        <p className="mt-1 text-sm text-muted">
          Start fresh to see how much you improve. Your cards, questions, notes,
          and bookmarks are always kept.
        </p>

        <div className="mt-4 space-y-3">
          {Object.entries(ACTIONS).map(([key, action]) =>
            confirming === key ? (
              <div
                key={key}
                role="alertdialog"
                aria-label={action.title}
                className="rounded-xl border border-warn bg-surface-2 p-4"
              >
                <p className="font-semibold">{action.title}</p>
                <p className="mt-1 text-sm text-muted">{action.detail}</p>
                <p className="mt-2 text-sm font-semibold text-warn">
                  This cannot be undone.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => runReset(key)}
                    disabled={busy}
                    className="rounded-xl bg-warn px-5 py-2.5 text-sm font-semibold text-app transition hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? 'Resetting...' : 'Yes, reset'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    disabled={busy}
                    className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-surface disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setConfirming(key)
                  setMessage('')
                  setError('')
                }}
                disabled={busy}
                className="block w-full rounded-xl border border-warn px-5 py-3 text-left text-sm font-semibold text-warn transition hover:bg-surface-2 disabled:opacity-60 sm:w-auto"
              >
                {action.button}
              </button>
            ),
          )}
        </div>

        {message && (
          <p role="status" className="mt-4 text-sm font-medium text-brand-strong">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Account</h2>
        <button
          type="button"
          onClick={onLogout}
          className="mt-3 rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-surface-2"
        >
          Log out
        </button>
      </section>
    </div>
  )
}
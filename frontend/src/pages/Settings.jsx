import { useState } from 'react'
import { useOutletContext } from 'react-router'
import { api } from '../api'

const BACKUP_KEY = 'thaling_last_backup'

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

const ACTIONS = {
  quiz: {
    scope: 'quiz',
    button: 'Reset quiz and exam progress',
    title: 'Reset quiz and exam progress?',
    detail:
      'This deletes all quiz and mock exam results. Every subject goes back to "No quiz answers yet", and your recent attempts are cleared. Your cards, questions, notes, and bookmarks stay.',
    done: (result) =>
      `Done. ${plural(result.attempts_deleted, 'attempt')} cleared. Every subject is back to "No quiz answers yet".`,
  },
  cards: {
    scope: 'cards',
    button: 'Reset flashcard schedule',
    title: 'Reset flashcard schedule?',
    detail:
      'Every card becomes new again and is due today, as if you had never studied it. Your cards, notes, and bookmarks stay.',
    done: (result) =>
      `Done. ${plural(result.cards_reset, 'card')} ${
        result.cards_reset === 1 ? 'is' : 'are'
      } new again and due today.`,
  },
}

function readLastBackup() {
  try {
    return localStorage.getItem(BACKUP_KEY)
  } catch {
    return null
  }
}

function saveLastBackup() {
  const now = new Date().toISOString()
  try {
    localStorage.setItem(BACKUP_KEY, now)
  } catch {
    // storage unavailable, the backup itself still worked
  }
  return now
}

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function summarizeImport(result) {
  const parts = []
  if (result.subjects_added) parts.push(plural(result.subjects_added, 'subject'))
  if (result.cards_added) parts.push(plural(result.cards_added, 'card'))
  if (result.questions_added) parts.push(plural(result.questions_added, 'question'))
  if (result.notes_added) parts.push(plural(result.notes_added, 'note'))
  if (result.attempts_added) {
    parts.push(plural(result.attempts_added, 'quiz or exam result'))
  }
  if (parts.length === 0) {
    return 'Nothing new to restore. Everything in that backup is already here.'
  }
  return `Restored ${parts.join(', ')}.`
}

const outlineButton =
  'rounded-xl border border-line px-5 py-3 text-sm font-semibold text-brand transition hover:bg-surface-2 disabled:opacity-60'

export default function Settings() {
  const { theme, setTheme, onLogout } = useOutletContext()

  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [lastBackup, setLastBackup] = useState(readLastBackup)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')
  const [backupError, setBackupError] = useState('')

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

  async function downloadBackup() {
    setExporting(true)
    setBackupError('')
    setBackupMessage('')
    try {
      const data = await api('/export/json')
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `thaling-backup-${new Date().toLocaleDateString('en-CA')}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setLastBackup(saveLastBackup())
      setBackupMessage(
        'Backup downloaded. Keep the file somewhere safe, like Google Drive.',
      )
    } catch (err) {
      setBackupError(err.message)
    } finally {
      setExporting(false)
    }
  }

  async function onPickBackup(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImporting(true)
    setBackupError('')
    setBackupMessage('')
    try {
      const form = new FormData()
      form.append('file', file)
      const result = await api('/import/json', { method: 'POST', body: form })
      setBackupMessage(summarizeImport(result))
    } catch (err) {
      setBackupError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
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
        <h2 className="font-semibold">Backup</h2>
        <p className="mt-1 text-sm text-muted">
          Save a copy of your subjects, cards, questions, notes, and results to
          this device. If your data is ever lost, you can restore it from the
          file. The file holds all your study material, so keep it private.
        </p>
        <p className="mt-2 text-xs text-muted">
          {lastBackup
            ? `Last backup from this device: ${formatWhen(lastBackup)}`
            : 'No backup made from this device yet.'}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadBackup}
            disabled={exporting || importing}
            className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-on-brand transition hover:bg-brand-strong disabled:opacity-60"
          >
            {exporting ? 'Preparing...' : 'Download backup'}
          </button>

          <label
            className={`cursor-pointer ${outlineButton} ${
              importing || exporting ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {importing ? 'Restoring...' : 'Restore from backup'}
            <input
              type="file"
              accept=".json,application/json"
              onChange={onPickBackup}
              disabled={importing || exporting}
              className="sr-only"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-muted">
          Restoring adds to what you have and never deletes anything. Items that
          already exist are skipped, so restoring the same file twice is safe.
        </p>

        {backupMessage && (
          <p role="status" className="mt-3 text-sm font-medium text-brand-strong">
            {backupMessage}
          </p>
        )}
        {backupError && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
            {backupError}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Progress</h2>
        <p className="mt-1 text-sm text-muted">
          Start fresh to see how much you improve. Your cards, questions, notes,
          and bookmarks are always kept. Download a backup first if you want to
          keep your old results.
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
        <button type="button" onClick={onLogout} className={`mt-3 ${outlineButton}`}>
          Log out
        </button>
      </section>
    </div>
  )
}
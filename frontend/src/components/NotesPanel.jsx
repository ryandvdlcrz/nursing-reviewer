import { useEffect, useState } from 'react'
import { api } from '../api'

const MAX_LENGTH = 5000

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'
const smallLink = 'text-xs font-semibold text-brand disabled:opacity-60'

export default function NotesPanel({ targetType, targetId }) {
  const [notes, setNotes] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({
      target_type: targetType,
      target_id: String(targetId),
    })
    api(`/notes?${query}`)
      .then((data) => {
        if (!active) return
        setNotes(data)
        setLoadError('')
      })
      .catch((err) => {
        if (active) setLoadError(err.message)
      })
    return () => {
      active = false
    }
  }, [targetType, targetId, reloadKey])

  async function addNote(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return

    setBusy(true)
    setError('')
    try {
      const created = await api('/notes', {
        method: 'POST',
        body: { target_type: targetType, target_id: targetId, text },
      })
      setNotes((current) => [...(current ?? []), created])
      setDraft('')
      setAdding(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(event) {
    event.preventDefault()
    const text = editText.trim()
    if (!text || busy) return

    setBusy(true)
    setError('')
    try {
      const updated = await api(`/notes/${editingId}`, {
        method: 'PUT',
        body: { text },
      })
      setNotes((current) =>
        current.map((note) => (note.id === updated.id ? updated : note)),
      )
      setEditingId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeNote(id) {
    if (busy) return

    setBusy(true)
    setError('')
    try {
      await api(`/notes/${id}`, { method: 'DELETE' })
      setNotes((current) => current.filter((note) => note.id !== id))
      setDeletingId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm">
        <p className="text-muted">Could not load your notes.</p>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className={`${smallLink} mt-1`}
        >
          Try again
        </button>
      </div>
    )
  }

  if (notes === null) {
    return (
      <div className="mt-4 h-14 animate-pulse rounded-2xl border border-line bg-surface" />
    )
  }

  return (
    <section
      aria-label="Your notes"
      className="mt-4 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">My notes</h3>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setEditingId(null)
              setDeletingId(null)
              setError('')
            }}
            className="text-sm font-semibold text-brand"
          >
            + Add note
          </button>
        )}
      </div>

      {notes.length === 0 && !adding && (
        <p className="mt-1 text-sm text-muted">
          No notes yet. Add a tip that helps you remember this one.
        </p>
      )}

      {notes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl bg-surface-2 p-3">
              {editingId === note.id ? (
                <form onSubmit={saveEdit}>
                  <textarea
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    maxLength={MAX_LENGTH}
                    rows={3}
                    aria-label="Edit note"
                    autoFocus
                    className={inputClass}
                  />
                  <div className="mt-2 flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={!editText.trim() || busy}
                      className={smallLink}
                    >
                      {busy ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                      className="text-xs font-semibold text-muted disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words text-sm">{note.text}</p>
                  <div className="mt-2 flex items-center gap-4">
                    {deletingId === note.id ? (
                      <>
                        <span className="text-xs font-semibold text-warn">
                          Delete this note?
                        </span>
                        <button
                          type="button"
                          onClick={() => removeNote(note.id)}
                          disabled={busy}
                          className="text-xs font-semibold text-warn disabled:opacity-60"
                        >
                          {busy ? 'Deleting...' : 'Yes, delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          disabled={busy}
                          className="text-xs font-semibold text-muted disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(note.id)
                            setEditText(note.text)
                            setAdding(false)
                            setDeletingId(null)
                            setError('')
                          }}
                          className={smallLink}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingId(note.id)
                            setEditingId(null)
                            setError('')
                          }}
                          className="text-xs font-semibold text-muted"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form onSubmit={addNote} className="mt-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_LENGTH}
            rows={3}
            aria-label="New note"
            placeholder="For example: a memory trick, or why you got it wrong"
            autoFocus
            className={inputClass}
          />
          <div className="mt-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={!draft.trim() || busy}
              className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-on-brand transition hover:bg-brand-strong disabled:opacity-60"
            >
              {busy ? 'Saving...' : 'Save note'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setDraft('')
                setError('')
              }}
              disabled={busy}
              className="text-xs font-semibold text-muted disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  )
}
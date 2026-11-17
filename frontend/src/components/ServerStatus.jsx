import { useSyncExternalStore } from 'react'
import { getSlow, subscribeSlow } from '../api'

export default function ServerStatus() {
  const slow = useSyncExternalStore(subscribeSlow, getSlow)
  if (!slow) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-3">
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-lg"
      >
        <span
          aria-hidden="true"
          className="mt-1 size-3 shrink-0 animate-pulse rounded-full bg-brand"
        />
        <p>
          <span className="font-semibold">Waking up the server...</span>{' '}
          <span className="text-muted">
            This can take up to a minute the first time. Please wait.
          </span>
        </p>
      </div>
    </div>
  )
}
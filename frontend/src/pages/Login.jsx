import { useState } from 'react'
import { login, setToken } from '../api'

export default function Login({ onSuccess }) {
  const [passcode, setPasscode] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!passcode || loading) return

    setLoading(true)
    setError('')
    try {
      const data = await login(passcode)
      setToken(data.access_token, remember)
      onSuccess()
    } catch (err) {
      setError(
        err.status === 401
          ? 'That passcode is not right. Please try again.'
          : err.message,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-app text-ink flex flex-col items-center justify-center gap-6 p-4 sm:p-8">
      <div className="w-full max-w-md rounded-3xl border border-line/60 bg-surface p-6 shadow-xl shadow-brand/10 sm:p-10">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-brand-strong sm:text-4xl">
            Thaling
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Nursing Reviewer
          </p>
        </header>

        <div className="mt-8 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">Welcome back, Thaling.</h2>
          <p className="mt-1 text-sm text-muted sm:text-base">
            Your own little space to learn and grow.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          <label htmlFor="passcode" className="block text-sm font-semibold">
            Passcode
          </label>
          <div className="relative mt-2">
            <input
              id="passcode"
              type={showPasscode ? 'text' : 'password'}
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              placeholder="Enter your passcode"
              autoComplete="current-password"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3.5 pr-20 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <button
              type="button"
              onClick={() => setShowPasscode((value) => !value)}
              className="absolute inset-y-0 right-4 text-sm font-semibold text-brand"
            >
              {showPasscode ? 'Hide' : 'Show'}
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <label className="mt-5 flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-5 accent-brand"
            />
            Remember me
          </label>

          <button
            type="submit"
            disabled={!passcode || loading}
            className="mt-6 w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-on-brand transition hover:bg-brand-strong disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="text-sm text-muted">Made with love, just for you.</p>
    </main>
  )
}
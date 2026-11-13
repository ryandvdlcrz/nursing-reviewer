import { useOutletContext } from 'react-router'

export default function Settings() {
  const { theme, setTheme, onLogout } = useOutletContext()

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
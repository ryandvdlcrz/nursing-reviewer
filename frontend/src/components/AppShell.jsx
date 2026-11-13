import { NavLink, Outlet } from 'react-router'
import Icon from './Icon'
import useTheme from '../hooks/useTheme'

const NAV = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/study', label: 'Study', icon: 'cards' },
  { to: '/quiz', label: 'Quiz', icon: 'quiz' },
  { to: '/add', label: 'Add', icon: 'plus' },
  { to: '/stats', label: 'Stats', icon: 'chart' },
]

const sideLink = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-surface-2 text-brand-strong'
      : 'text-muted hover:bg-surface-2 hover:text-ink'
  }`

const tabLink = ({ isActive }) =>
  `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold ${
    isActive ? 'text-brand' : 'text-muted'
  }`

function Brand({ small = false }) {
  return (
    <div>
      <p
        className={`font-bold tracking-tight text-brand-strong ${
          small ? 'text-xl' : 'text-3xl'
        }`}
      >
        Thaling
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">
        Nursing Reviewer
      </p>
    </div>
  )
}

export default function AppShell({ onLogout }) {
  const { theme, setTheme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const themeLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <div className="min-h-screen bg-app text-ink md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-line md:bg-surface md:p-5">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={sideLink}>
              <Icon name={item.icon} className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <button
            type="button"
            onClick={toggle}
            aria-label={themeLabel}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <Icon name={isDark ? 'sun' : 'moon'} className="size-5" />
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          <NavLink to="/settings" className={sideLink}>
            <Icon name="settings" className="size-5" />
            Settings
          </NavLink>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-app/90 px-4 py-3 backdrop-blur md:hidden">
          <Brand small />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggle}
              aria-label={themeLabel}
              className="rounded-xl p-2.5 text-muted hover:bg-surface-2"
            >
              <Icon name={isDark ? 'sun' : 'moon'} />
            </button>
            <NavLink
              to="/settings"
              aria-label="Settings"
              className="rounded-xl p-2.5 text-muted hover:bg-surface-2"
            >
              <Icon name="settings" />
            </NavLink>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 pb-28 md:px-8 md:py-10 md:pb-10">
          <Outlet context={{ theme, setTheme, onLogout }} />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface md:hidden">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={tabLink}>
            <Icon name={item.icon} className="size-6" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
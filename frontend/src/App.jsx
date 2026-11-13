import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { clearToken, getToken, setUnauthorizedHandler } from './api'
import AppShell from './components/AppShell'
import ComingSoon from './pages/ComingSoon'
import Home from './pages/Home'
import Login from './pages/Login'
import Settings from './pages/Settings'

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()))

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthed(false))
  }, [])

  function logout() {
    clearToken()
    setAuthed(false)
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell onLogout={logout} />}>
          <Route index element={<Home />} />
          <Route path="study" element={<ComingSoon title="Study" />} />
          <Route path="quiz" element={<ComingSoon title="Quiz" />} />
          <Route path="mock" element={<ComingSoon title="Mock exam" />} />
          <Route path="add" element={<ComingSoon title="Add content" />} />
          <Route path="stats" element={<ComingSoon title="Stats" />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { clearToken, getToken, setUnauthorizedHandler } from './api'
import AppShell from './components/AppShell'
import Add from './pages/Add'
import ComingSoon from './pages/ComingSoon'
import Home from './pages/Home'
import Login from './pages/Login'
import Practice from './pages/Practice'
import Settings from './pages/Settings'
import Study from './pages/Study'

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
          <Route path="study" element={<Study />} />
          <Route path="quiz" element={<Practice key="quiz" mode="quiz" />} />
          <Route path="mock" element={<Practice key="mock" mode="mock" />} />
          <Route path="add" element={<Add />} />
          <Route path="stats" element={<ComingSoon title="Stats" />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
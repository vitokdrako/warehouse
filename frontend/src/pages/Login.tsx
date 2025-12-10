import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Помилка авторизації')
      }

      // Save token to localStorage
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))

      // Navigate to dashboard
      navigate('/dashboard')
      window.location.reload() // Reload to update navigation
    } catch (err: any) {
      setError(err.message || 'Помилка авторизації')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-corp-bg-page flex items-center justify-center p-4 font-montserrat">
      <div className="corp-card shadow-corp-lg w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-corp-primary">
            <span className="text-4xl font-bold text-white">R</span>
          </div>
          <h1 className="text-3xl font-bold text-corp-text-dark">Rental Hub</h1>
          <p className="text-sm text-corp-text-muted mt-2">Увійдіть у свій акаунт</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="text-xs text-corp-text-muted uppercase tracking-wide mb-2 block font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="corp-input"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-xs text-corp-text-muted uppercase tracking-wide mb-2 block font-medium">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="corp-input"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="corp-badge corp-badge-error p-3 text-center w-full">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full corp-btn corp-btn-primary py-3 text-base disabled:opacity-50"
          >
            {loading ? 'Завантаження...' : 'Увійти'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-corp-text-muted">
          <p className="mb-2">Для отримання доступу зверніться до адміністратора</p>
          <p>© 2024 Rental Hub • Powered by <span className="text-corp-primary font-semibold">FarforRent</span></p>
        </div>
      </div>
    </div>
  )
}

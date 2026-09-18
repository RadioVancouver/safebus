import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

import './Login.css'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(event) {
    event.preventDefault()

    setError('')
    setLoading(true)

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password
      })

    if (loginError) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }

    const user = data.user

    const { data: profile, error: profileError } =
      await supabase
        .from('profiles')
        .select('full_name, role, active')
        .eq('id', user.id)
        .single()

    if (profileError || !profile) {
      setError('No se encontró el perfil del usuario.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (!profile.active) {
      setError('Esta cuenta se encuentra desactivada.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    setLoading(false)

    if (profile.role === 'admin') {
      navigate('/admin')
      return
    }

    if (profile.role === 'driver') {
      navigate('/conductor')
      return
    }

    if (profile.role === 'student') {
      navigate('/estudiante')
      return
    }

    if (profile.role === 'guardian') {
      navigate('/familiar')
      return
    }

    setError('El usuario no tiene un rol válido.')
  }

  return (
    <main className="login-page">

      <section className="login-card">

        <div className="login-icon">
          🛡️
        </div>

        <p className="login-label">
          SAFE BUS
        </p>

        <h1>Iniciar sesión</h1>

        <p className="login-description">
          Ingresa al sistema de seguridad escolar
        </p>

        <form
          className="login-form"
          onSubmit={handleLogin}
        >

          <div className="form-group">

            <label htmlFor="email">
              Correo electrónico
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="correo@ejemplo.com"
              required
              autoComplete="email"
            />

          </div>

          <div className="form-group">

            <label htmlFor="password">
              Contraseña
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Ingresa tu contraseña"
              required
              autoComplete="current-password"
            />

          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'INGRESANDO...' : 'INGRESAR'}
          </button>

        </form>

        <button
          className="back-button"
          onClick={() => navigate('/')}
        >
          ← Volver
        </button>

      </section>

    </main>
  )
}

export default Login
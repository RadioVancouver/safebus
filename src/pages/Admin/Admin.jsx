import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

import './Admin.css'

function Admin() {
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function goToStudents() {
    setMenuOpen(false)
    navigate('/admin/estudiantes')
  }

  return (
    <main className="admin-layout">

      <header className="admin-header">

        <div className="admin-brand">
          <div className="admin-logo">
            🛡️
          </div>

          <div>
            <strong>SAFE BUS</strong>
            <span>Administración</span>
          </div>
        </div>

        <button
          className="menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>

        <nav className={menuOpen ? 'admin-nav open' : 'admin-nav'}>

          <button
            className="nav-item active"
            onClick={() => {
              setMenuOpen(false)
              navigate('/admin')
            }}
          >
            Inicio
          </button>

          <button
            className="nav-item"
            onClick={goToStudents}
          >
            Estudiantes
          </button>

          <button className="nav-item">
            Conductores
          </button>

          <button className="nav-item">
            Buses
          </button>

          <button className="nav-item">
            Alertas
          </button>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>

        </nav>

      </header>

      <section className="admin-content">

        <div className="admin-welcome">
          <div>
            <p className="section-label">
              PANEL DE ADMINISTRACIÓN
            </p>

            <h1>Bienvenido a SafeBus</h1>

            <p>
              Gestiona la seguridad y el transporte escolar
              de la I.E. Juana Cervantes de Bolognesi.
            </p>
          </div>
        </div>

        <div className="dashboard-grid">

          <article
            className="dashboard-card"
            onClick={goToStudents}
            style={{ cursor: 'pointer' }}
          >
            <span className="card-icon">👨‍🎓</span>

            <div>
              <span className="card-title">
                Estudiantes
              </span>

              <strong>0</strong>
            </div>
          </article>

          <article className="dashboard-card">
            <span className="card-icon">🚍</span>

            <div>
              <span className="card-title">
                Buses
              </span>

              <strong>0</strong>
            </div>
          </article>

          <article className="dashboard-card">
            <span className="card-icon">👨‍✈️</span>

            <div>
              <span className="card-title">
                Conductores
              </span>

              <strong>0</strong>
            </div>
          </article>

          <article className="dashboard-card alert-card">
            <span className="card-icon">🚨</span>

            <div>
              <span className="card-title">
                Alertas activas
              </span>

              <strong>0</strong>
            </div>
          </article>

        </div>

        <section className="admin-info">

          <h2>Estado del sistema</h2>

          <div className="system-status">
            <span></span>

            <div>
              <strong>Sistema operativo</strong>

              <p>
                SafeBus está conectado y listo para
                gestionar el transporte escolar.
              </p>
            </div>
          </div>

        </section>

      </section>

    </main>
  )
}

export default Admin
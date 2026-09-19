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

  function goToDrivers() {
    setMenuOpen(false)
    navigate('/admin/conductores')
  }

  function goToBuses() {
    setMenuOpen(false)
    navigate('/admin/buses')
  }

  function goToGuardians() {
    setMenuOpen(false)
    navigate('/admin/familiares')
  }

  function goToAlerts() {
    setMenuOpen(false)
    navigate('/admin/alertas')
  }

  return (
    <main className="admin-layout">

      {/* =========================
          CABECERA
         ========================= */}

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

          <button
            className="nav-item"
            onClick={goToDrivers}
          >
            Conductores
          </button>

          <button
            className="nav-item"
            onClick={goToBuses}
          >
            Buses
          </button>

          <button
            className="nav-item"
            onClick={goToGuardians}
          >
            Familiares
          </button>

          {/* ALERTAS */}
          <button
            className="nav-item"
            onClick={goToAlerts}
          >
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


      {/* =========================
          CONTENIDO
         ========================= */}

      <section className="admin-content">

        <div className="admin-welcome">

          <div>

            <p className="section-label">
              PANEL DE ADMINISTRACIÓN
            </p>

            <h1>
              Bienvenido a SafeBus
            </h1>

            <p>
              Gestiona la seguridad y el transporte escolar
              de la I.E. Juana Cervantes de Bolognesi.
            </p>

          </div>

        </div>


        {/* =========================
            TARJETAS
           ========================= */}

        <div className="dashboard-grid">

          {/* ESTUDIANTES */}

          <article
            className="dashboard-card"
            onClick={goToStudents}
            style={{ cursor: 'pointer' }}
          >

            <div className="card-icon">
              🎓
            </div>

            <div>
              <h3>Estudiantes</h3>

              <p>
                Registrar y administrar estudiantes.
              </p>

              <strong>
                Gestionar →
              </strong>
            </div>

          </article>


          {/* BUSES */}

          <article
            className="dashboard-card"
            onClick={goToBuses}
            style={{ cursor: 'pointer' }}
          >

            <div className="card-icon">
              🚌
            </div>

            <div>
              <h3>Buses</h3>

              <p>
                Registrar y administrar vehículos.
              </p>

              <strong>
                Gestionar →
              </strong>
            </div>

          </article>


          {/* CONDUCTORES */}

          <article
            className="dashboard-card"
            onClick={goToDrivers}
            style={{ cursor: 'pointer' }}
          >

            <div className="card-icon">
              👨‍✈️
            </div>

            <div>
              <h3>Conductores</h3>

              <p>
                Registrar conductores y asignar vehículos.
              </p>

              <strong>
                Gestionar →
              </strong>
            </div>

          </article>


          {/* ALERTAS */}

          <article
            className="dashboard-card alert-card"
            onClick={goToAlerts}
            style={{ cursor: 'pointer' }}
          >

            <div className="card-icon">
              🚨
            </div>

            <div>
              <h3>Alertas activas</h3>

              <p>
                Supervisar situaciones de emergencia.
              </p>

              <strong>
                Ver alertas →
              </strong>
            </div>

          </article>

        </div>


        {/* =========================
            INFORMACIÓN
           ========================= */}

        <section className="admin-info">

          <div className="info-icon">
            🛡️
          </div>

          <div>

            <h2>
              Sistema SafeBus
            </h2>

            <p>
              Desde este panel puedes administrar los
              estudiantes, conductores y vehículos registrados
              en el sistema.
            </p>

            <p>
              Los vehículos registrados podrán posteriormente
              ser asignados a los conductores correspondientes.
            </p>

          </div>

        </section>

      </section>

    </main>
  )
}

export default Admin
import { useNavigate } from 'react-router-dom'
import './Intro.css'

function Intro() {
  const navigate = useNavigate()

  return (
    <main className="intro">
      <section className="intro-card">

        <div className="intro-icon">
          🛡️
        </div>

        <p className="intro-label">
          SISTEMA DE SEGURIDAD ESCOLAR
        </p>

        <h1>SAFE BUS</h1>

        <p className="intro-description">
          Sistema de alerta y seguridad para el transporte escolar
        </p>

        <div className="school">
          <h2>I.E. Juana Cervantes de Bolognesi</h2>
          <p>Arequipa – Perú</p>
        </div>

        <button
          className="intro-button"
          onClick={() => navigate('/login')}
        >
          INGRESAR AL SISTEMA
        </button>

        <p className="intro-footer">
          Seguridad · Comunicación · Geolocalización
        </p>

      </section>
    </main>
  )
}

export default Intro
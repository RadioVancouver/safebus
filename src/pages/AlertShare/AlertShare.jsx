import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import './AlertShare.css'

function formatDate(value) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function AlertShare() {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  async function loadAlert() {
    if (!token) {
      setError('El enlace de seguimiento no es válido.')
      setLoading(false)
      return
    }

    const { data: result, error: functionError } =
      await supabase.functions.invoke(
        'get-alert-by-token',
        {
          body: { token },
        },
      )

    if (functionError) {
      console.error(
        'Error consultando alerta compartida:',
        functionError,
      )

      setError(
        'No se pudo consultar la alerta. El enlace puede haber expirado o ya no estar disponible.',
      )
      setLoading(false)
      return
    }

    if (!result?.success) {
      setError(
        result?.error ||
          'El enlace no es válido o ya no está disponible.',
      )
      setLoading(false)
      return
    }

    setData(result)
    setLastUpdate(new Date())
    setLoading(false)
  }

  useEffect(() => {
    loadAlert()

    const interval = setInterval(() => {
      loadAlert()
    }, 5000)

    return () => clearInterval(interval)
  }, [token])

  if (loading && !data) {
    return (
      <main className="share-page">
        <section className="share-card share-loading">
          <div className="share-logo">🛡️</div>
          <h1>SafeBus</h1>
          <p>Consultando la alerta...</p>
        </section>
      </main>
    )
  }

  if (error && !data) {
    return (
      <main className="share-page">
        <section className="share-card share-error">
          <div className="share-logo">🛡️</div>
          <div className="share-badge share-badge-error">
            ENLACE NO DISPONIBLE
          </div>
          <h1>Seguimiento SafeBus</h1>
          <p>{error}</p>
          <small>
            Por seguridad, este enlace solamente funciona
            mientras la alerta esté disponible.
          </small>
        </section>
      </main>
    )
  }

  const alert = data.alert
  const location = data.location

  const mapUrl =
    location?.latitude != null &&
    location?.longitude != null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${
          Number(location.longitude) - 0.01
        }%2C${
          Number(location.latitude) - 0.01
        }%2C${
          Number(location.longitude) + 0.01
        }%2C${
          Number(location.latitude) + 0.01
        }&layer=mapnik&marker=${
          location.latitude
        }%2C${location.longitude}`
      : null

  const isActive = alert?.status === 'active'

  return (
    <main className="share-page">
      <header className="share-header">
        <div className="share-brand">
          <div className="share-logo">🛡️</div>
          <div>
            <strong>SAFE BUS</strong>
            <span>Seguimiento de emergencia</span>
          </div>
        </div>
      </header>

      <section className="share-content">
        <div
          className={`share-status ${
            isActive
              ? 'share-status-active'
              : 'share-status-closed'
          }`}
        >
          <span className="share-status-dot" />
          {isActive
            ? 'ALERTA ACTIVA'
            : 'ALERTA FINALIZADA'}
        </div>

        <h1>
          {isActive
            ? 'Un estudiante necesita atención'
            : 'La alerta ya finalizó'}
        </h1>

        <p className="share-intro">
          Esta página muestra información de seguimiento
          autorizada mediante un enlace seguro de SafeBus.
        </p>

        <section className="share-info-grid">
          <div className="share-info-item">
            <span>Estudiante</span>
            <strong>
              {alert?.student_name || 'Estudiante'}
            </strong>
          </div>

          <div className="share-info-item">
            <span>Estado</span>
            <strong>
              {isActive ? 'En atención' : 'Finalizada'}
            </strong>
          </div>

          <div className="share-info-item">
            <span>Alerta creada</span>
            <strong>
              {formatDate(alert?.created_at)}
            </strong>
          </div>

          <div className="share-info-item">
            <span>Última ubicación</span>
            <strong>
              {formatDate(location?.recorded_at)}
            </strong>
          </div>
        </section>

        {mapUrl ? (
          <section className="share-map-card">
            <div className="share-map-header">
              <div>
                <h2>Ubicación del estudiante</h2>
                <p>
                  {isActive
                    ? 'La ubicación se actualiza automáticamente.'
                    : 'Última ubicación registrada.'}
                </p>
              </div>

              <span className="gps-pill">
                📍 GPS
              </span>
            </div>

            <iframe
              title="Ubicación SafeBus"
              src={mapUrl}
              className="share-map"
              loading="lazy"
            />

            <div className="share-coordinates">
              <span>
                Latitud: {Number(location.latitude).toFixed(6)}
              </span>
              <span>
                Longitud:{' '}
                {Number(location.longitude).toFixed(6)}
              </span>
              {location.accuracy != null && (
                <span>
                  Precisión: ±
                  {Math.round(location.accuracy)} m
                </span>
              )}
            </div>

            {lastUpdate && isActive && (
              <p className="share-refresh">
                Actualizado:
                {' '}
                {formatDate(lastUpdate)}
              </p>
            )}
          </section>
        ) : (
          <section className="share-no-location">
            <div>📍</div>
            <h2>Ubicación no disponible todavía</h2>
            <p>
              SafeBus todavía no ha recibido una ubicación
              GPS para esta alerta.
            </p>
          </section>
        )}

        <div className="share-security">
          <span>🔒</span>
          <p>
            Este enlace es privado. No compartas su contenido
            públicamente. SafeBus dejará de mostrar la alerta
            cuando esta sea finalizada o el enlace expire.
          </p>
        </div>
      </section>
    </main>
  )
}

export default AlertShare

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import './AdminAlerts.css'

function AdminAlerts() {
  const navigate = useNavigate()

  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const channelRef = useRef(null)

  const getStudentName = (alert) => {
    return (
      alert.students?.full_name ||
      alert.students?.profiles?.full_name ||
      alert.student_name ||
      alert.student_code ||
      'Estudiante'
    )
  }

  const getAlertTypeName = (type) => {
    const types = {
      emergency: 'Emergencia',
      harassment: 'Acoso',
      medical: 'Emergencia médica',
      other: 'Otra situación'
    }

    return types[type] || 'Emergencia'
  }

  const getTransportName = (type) => {
    const types = {
      sit: 'SIT',
      combi: 'Combi',
      bus: 'Bus',
      taxi: 'Taxi',
      other: 'Otro'
    }

    return types[type] || 'Vehículo'
  }

  const formatDate = (date) => {
    if (!date) return 'Sin fecha'

    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(new Date(date))
  }

  const formatLocation = (alert) => {
    const location = alert.latest_location

    if (!location) {
      if (
        alert.last_latitude !== null &&
        alert.last_latitude !== undefined &&
        alert.last_longitude !== null &&
        alert.last_longitude !== undefined
      ) {
        return `${Number(alert.last_latitude).toFixed(5)}, ${Number(
          alert.last_longitude
        ).toFixed(5)}`
      }

      if (
        alert.initial_latitude !== null &&
        alert.initial_latitude !== undefined &&
        alert.initial_longitude !== null &&
        alert.initial_longitude !== undefined
      ) {
        return `${Number(alert.initial_latitude).toFixed(5)}, ${Number(
          alert.initial_longitude
        ).toFixed(5)}`
      }

      return 'Esperando GPS'
    }

    return `${Number(location.latitude).toFixed(5)}, ${Number(
      location.longitude
    ).toFixed(5)}`
  }

  const getLocation = (alert) => {
    const location = alert.latest_location

    if (location) {
      return {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude)
      }
    }

    if (
      alert.last_latitude !== null &&
      alert.last_latitude !== undefined &&
      alert.last_longitude !== null &&
      alert.last_longitude !== undefined
    ) {
      return {
        latitude: Number(alert.last_latitude),
        longitude: Number(alert.last_longitude)
      }
    }

    if (
      alert.initial_latitude !== null &&
      alert.initial_latitude !== undefined &&
      alert.initial_longitude !== null &&
      alert.initial_longitude !== undefined
    ) {
      return {
        latitude: Number(alert.initial_latitude),
        longitude: Number(alert.initial_longitude)
      }
    }

    return null
  }

  const openLocation = (alert) => {
    const location = getLocation(alert)

    if (!location) {
      setError('Esta alerta todavía no tiene una ubicación GPS disponible.')
      return
    }

    const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const enrichAlertsWithLocations = async (alertList) => {
    if (!alertList.length) return []

    const enriched = await Promise.all(
      alertList.map(async (alert) => {
        const { data: location, error: locationError } = await supabase
          .from('alert_locations')
          .select('latitude, longitude, accuracy, recorded_at')
          .eq('alert_id', alert.id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (locationError) {
          console.error(
            'Error obteniendo ubicación de alerta:',
            locationError
          )
        }

        return {
          ...alert,
          latest_location: location || null
        }
      })
    )

    return enriched
  }

  const loadAlerts = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setRefreshing(true)
      }

      setError('')

      const { data, error: alertsError } = await supabase
        .from('alerts')
        .select(`
          id,
          student_id,
          bus_id,
          driver_id,
          type,
          status,
          message,
          vehicle_description,
          route_description,
          initial_latitude,
          initial_longitude,
          last_latitude,
          last_longitude,
          last_location_at,
          created_at,
          attended_at,
          resolved_at,
          students (
            id,
            student_code,
            full_name,
            grade,
            section,
            profile_id,
            profiles (
              full_name,
              phone
            )
          ),
          buses (
            id,
            plate,
            code,
            transport_type,
            route,
            operator_name,
            capacity
          ),
          drivers (
            id,
            profile_id,
            license_number,
            profiles (
              full_name,
              phone
            )
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (alertsError) {
        throw alertsError
      }

      const enriched = await enrichAlertsWithLocations(data || [])

      setAlerts(enriched)
    } catch (err) {
      console.error('Error cargando alertas administrativas:', err)

      setError(
        err?.message ||
          'No se pudieron cargar las alertas de emergencia.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadAlerts(true)
  }, [loadAlerts])

  useEffect(() => {
    const interval = setInterval(() => {
      loadAlerts(false)
    }, 5000)

    return () => clearInterval(interval)
  }, [loadAlerts])

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel('admin-active-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts'
        },
        async () => {
          await loadAlerts(false)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alert_locations'
        },
        async () => {
          await loadAlerts(false)
        }
      )
      .subscribe((status) => {
        console.log('Estado canal administrador:', status)
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [loadAlerts])

  const updateAlertStatus = async (alertId, status) => {
    try {
      setError('')
      setMessage('')

      const updateData = {
        status
      }

      if (status === 'attended') {
        updateData.attended_at = new Date().toISOString()
      }

      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('alerts')
        .update(updateData)
        .eq('id', alertId)

      if (updateError) {
        throw updateError
      }

      if (status === 'attended') {
        setMessage('La alerta fue marcada como atendida.')
      }

      if (status === 'resolved') {
        setMessage('La alerta fue marcada como resuelta.')
      }

      await loadAlerts(false)
    } catch (err) {
      console.error('Error actualizando alerta:', err)

      setError(
        err?.message ||
          'No se pudo actualizar el estado de la alerta.'
      )
    }
  }

  const markAttended = async (alert) => {
    const confirmed = window.confirm(
      `¿Confirmas que la alerta de ${getStudentName(
        alert
      )} está siendo atendida?`
    )

    if (!confirmed) return

    await updateAlertStatus(alert.id, 'attended')
  }

  const resolveAlert = async (alert) => {
    const confirmed = window.confirm(
      `¿Confirmas que la alerta de ${getStudentName(
        alert
      )} ya fue resuelta?`
    )

    if (!confirmed) return

    await updateAlertStatus(alert.id, 'resolved')
  }

  return (
    <div className="admin-alerts-page">
      <header className="admin-alerts-header">
        <div>
          <button
            type="button"
            className="admin-alerts-back"
            onClick={() => navigate('/admin')}
          >
            ← Volver al panel
          </button>

          <p className="admin-alerts-eyebrow">
            SEGURIDAD
          </p>

          <h1>Alertas de emergencia</h1>

          <p className="admin-alerts-subtitle">
            Supervisa las situaciones de emergencia activas
            registradas por los estudiantes.
          </p>
        </div>

        <div className="admin-alerts-header-status">
          <span
            className={
              alerts.length > 0
                ? 'admin-alerts-status-dot active'
                : 'admin-alerts-status-dot'
            }
          ></span>

          <div>
            <strong>{alerts.length}</strong>
            <span>
              {alerts.length === 1
                ? ' alerta activa'
                : ' alertas activas'}
            </span>
          </div>
        </div>
      </header>

      {message && (
        <div className="admin-alerts-message success">
          <span>✓</span>
          <div>{message}</div>

          <button
            type="button"
            onClick={() => setMessage('')}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="admin-alerts-message error">
          <span>⚠</span>
          <div>{error}</div>

          <button
            type="button"
            onClick={() => setError('')}
          >
            ×
          </button>
        </div>
      )}

      <section className="admin-alerts-toolbar">
        <div>
          <strong>Supervisión en tiempo real</strong>
          <span>
            Las alertas y ubicaciones se actualizan
            automáticamente.
          </span>
        </div>

        <button
          type="button"
          className="admin-alerts-refresh"
          onClick={() => loadAlerts(true)}
          disabled={refreshing}
        >
          <span className={refreshing ? 'spinning' : ''}>
            ↻
          </span>
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </section>

      {loading ? (
        <div className="admin-alerts-empty">
          <div className="admin-alerts-loading-icon">
            ↻
          </div>

          <h2>Cargando alertas...</h2>

          <p>
            Consultando las situaciones de emergencia
            activas.
          </p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="admin-alerts-empty">
          <div className="admin-alerts-empty-icon">
            ✓
          </div>

          <h2>No hay alertas activas</h2>

          <p>
            Actualmente no existen situaciones de emergencia
            activas en SafeBus.
          </p>

          <span>
            Esta pantalla se actualizará automáticamente.
          </span>
        </div>
      ) : (
        <section className="admin-alerts-list">
          {alerts.map((alert) => {
            const studentName = getStudentName(alert)
            const location = getLocation(alert)

            const driverName =
              alert.drivers?.profiles?.full_name ||
              'Sin conductor asignado'

            const vehiclePlate =
              alert.buses?.plate ||
              alert.vehicle_description ||
              'No especificado'

            return (
              <article
                className="admin-alert-card"
                key={alert.id}
              >
                <div className="admin-alert-card-top">
                  <div className="admin-alert-main-info">
                    <div className="admin-alert-icon">
                      🚨
                    </div>

                    <div>
                      <span className="admin-alert-live">
                        ALERTA ACTIVA
                      </span>

                      <h2>{studentName}</h2>

                      <p>
                        {alert.students?.grade || 'Grado no registrado'}

                        {alert.students?.section
                          ? ` - ${alert.students.section}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="admin-alert-time">
                    {formatDate(alert.created_at)}
                  </div>
                </div>

                <div className="admin-alert-details">
                  <div className="admin-alert-detail">
                    <span>Tipo de alerta</span>
                    <strong>
                      {getAlertTypeName(alert.type)}
                    </strong>
                  </div>

                  <div className="admin-alert-detail">
                    <span>Vehículo</span>
                    <strong>{vehiclePlate}</strong>

                    {alert.buses?.transport_type && (
                      <small>
                        {getTransportName(
                          alert.buses.transport_type
                        )}
                      </small>
                    )}
                  </div>

                  <div className="admin-alert-detail">
                    <span>Conductor</span>
                    <strong>{driverName}</strong>

                    {alert.drivers?.profiles?.phone && (
                      <small>
                        {alert.drivers.profiles.phone}
                      </small>
                    )}
                  </div>

                  <div className="admin-alert-detail">
                    <span>Ubicación GPS</span>

                    <strong>
                      {formatLocation(alert)}
                    </strong>

                    {alert.latest_location?.recorded_at && (
                      <small>
                        Actualizada{' '}
                        {formatDate(
                          alert.latest_location.recorded_at
                        )}
                      </small>
                    )}
                  </div>
                </div>

                {alert.message && (
                  <div className="admin-alert-message">
                    <span>Mensaje del estudiante</span>
                    <p>{alert.message}</p>
                  </div>
                )}

                <div className="admin-alert-actions">
                  <button
                    type="button"
                    className="admin-alert-location-button"
                    onClick={() => openLocation(alert)}
                    disabled={!location}
                  >
                    Ver ubicación
                  </button>

                  <div className="admin-alert-status-actions">
                    <button
                      type="button"
                      className="admin-alert-attend-button"
                      onClick={() => markAttended(alert)}
                    >
                      Marcar atendida
                    </button>

                    <button
                      type="button"
                      className="admin-alert-resolve-button"
                      onClick={() => resolveAlert(alert)}
                    >
                      Resolver alerta
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

export default AdminAlerts
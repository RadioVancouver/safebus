import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

import './Conductor.css'

function Conductor() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [driver, setDriver] = useState(null)
  const [profile, setProfile] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [buses, setBuses] = useState([])
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [selectedBusId, setSelectedBusId] = useState('')
  const [saving, setSaving] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lastAlertId, setLastAlertId] = useState(null)
  const channelRef = useRef(null)
  const audioContextRef = useRef(null)
  const soundTimerRef = useRef(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem('safebus_driver_notifications') === 'true'
  )

  useEffect(() => {
    initialize()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      stopAlertNotification()
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
    }
  }, [])

  async function initialize() {
    try {
      setLoading(true)
      setError('')

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        navigate('/login')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      if (profileData.role !== 'driver') {
        navigate('/login')
        return
      }

      setProfile(profileData)

      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      if (driverError) throw driverError

      setDriver(driverData)

      await loadDriverData(driverData.id)
      subscribeToAlerts(driverData.id)

    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo cargar el portal del conductor.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDriverData(driverId) {
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('driver_vehicle_assignments')
      .select(`
        *,
        buses (
          id,
          code,
          plate,
          transport_type,
          route,
          operator_name,
          capacity,
          active
        )
      `)
      .eq('driver_id', driverId)
      .eq('active', true)
      .is('ended_at', null)
      .maybeSingle()

    if (assignmentError) throw assignmentError

    setAssignment(assignmentData)
    setSelectedBusId(assignmentData?.bus_id || '')

    const { data: busesData, error: busesError } = await supabase
      .from('buses')
      .select('id, code, plate, transport_type, route, operator_name, capacity, active')
      .eq('active', true)
      .order('plate', { ascending: true })

    if (busesError) throw busesError
    setBuses(busesData || [])

    await loadActiveAlerts(driverId)
  }

  async function loadActiveAlerts(driverId) {
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
        created_at,
        initial_latitude,
        initial_longitude,
        last_latitude,
        last_longitude,
        last_location_at,
        vehicle_description,
        route_description,
        students (
          id,
          student_code,
          full_name,
          grade,
          section
        )
      `)
      .eq('driver_id', driverId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (alertsError) throw alertsError

    const enriched = await enrichAlertsWithLocations(data || [])

    setAlerts(enriched)

    if (enriched.length > 0) {
      setLastAlertId(enriched[0].id)
    }
  }

  async function enrichAlertsWithLocations(alertList) {
    return Promise.all(
      alertList.map(async (alert) => {
        const { data: location } = await supabase
          .from('alert_locations')
          .select('latitude, longitude, accuracy, recorded_at')
          .eq('alert_id', alert.id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          ...alert,
          latest_location: location || null
        }
      })
    )
  }

  function subscribeToAlerts(driverId) {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`driver-alerts-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
          filter: `driver_id=eq.${driverId}`
        },
        async () => {
          try {
            await loadActiveAlerts(driverId)
          } catch (err) {
            console.error('Error actualizando alertas:', err)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alert_locations'
        },
        async (payload) => {
          const alertId = payload.new?.alert_id

          if (!alertId) return

          const exists = alerts.some((alert) => alert.id === alertId)

          if (exists) {
            await loadActiveAlerts(driverId)
          }
        }
      )
      .subscribe((status) => {
        console.log('Estado canal de alertas:', status)
      })

    channelRef.current = channel
  }

  useEffect(() => {
    if (!driver?.id) return

    const interval = setInterval(() => {
      loadActiveAlerts(driver.id).catch((err) => {
        console.error('Error actualizando alertas:', err)
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [driver?.id])

  useEffect(() => {
    if (!alerts.length) return

    const newest = alerts[0]

    if (lastAlertId && newest.id !== lastAlertId) {
      setMessage('Hay una nueva alerta de emergencia asignada a tu vehículo.')
      notifyNewAlert()
    }

    setLastAlertId(newest.id)
  }, [alerts])

  function getAudioContext() {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext

    if (!AudioContextClass) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass()
    }

    return audioContextRef.current
  }

  function playAlertBeep(audioContext, startTime, frequency = 880) {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, startTime)

    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)

    oscillator.start(startTime)
    oscillator.stop(startTime + 0.38)
  }

  async function enableNotifications() {
    try {
      const audioContext = getAudioContext()

      if (audioContext) {
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }

        const now = audioContext.currentTime
        playAlertBeep(audioContext, now, 660)
        playAlertBeep(audioContext, now + 0.48, 880)
      }

      if ('vibrate' in navigator) {
        navigator.vibrate([120, 80, 120])
      }

      localStorage.setItem('safebus_driver_notifications', 'true')
      setNotificationsEnabled(true)
      setMessage('Sonido y vibración de alertas activados.')
    } catch (err) {
      console.warn('No se pudieron activar las notificaciones:', err)
      setError('El navegador no permitió activar el sonido. Pulsa nuevamente el botón.')
    }
  }

  function disableNotifications() {
    localStorage.setItem('safebus_driver_notifications', 'false')
    setNotificationsEnabled(false)
    stopAlertNotification()
    setMessage('Sonido y vibración desactivados. Las alertas seguirán apareciendo en pantalla.')
  }

  function stopAlertNotification() {
    if (soundTimerRef.current) {
      clearTimeout(soundTimerRef.current)
      soundTimerRef.current = null
    }

    if ('vibrate' in navigator) {
      navigator.vibrate(0)
    }
  }

  async function notifyNewAlert() {
    if (!notificationsEnabled) {
      if ('vibrate' in navigator) {
        navigator.vibrate([250, 120, 250])
      }
      return
    }

    try {
      const audioContext = getAudioContext()

      if (audioContext) {
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }

        const now = audioContext.currentTime
        playAlertBeep(audioContext, now, 880)
        playAlertBeep(audioContext, now + 0.48, 1046)
        playAlertBeep(audioContext, now + 0.96, 880)

        soundTimerRef.current = setTimeout(() => {
          try {
            const ctx = getAudioContext()
            if (ctx && ctx.state === 'running') {
              const t = ctx.currentTime
              playAlertBeep(ctx, t, 880)
              playAlertBeep(ctx, t + 0.48, 1046)
            }
          } catch (err) {
            console.warn('No se pudo repetir el sonido:', err)
          }
        }, 2500)
      }

      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300, 100, 500])
      }
    } catch (err) {
      console.warn('No se pudo reproducir la alerta sonora:', err)
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300])
      }
    }
  }

  async function changeVehicle() {
    if (!driver || !selectedBusId) {
      setError('Selecciona un vehículo.')
      return
    }

    if (assignment?.bus_id === selectedBusId) {
      setError('Ese vehículo ya está asignado actualmente.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setMessage('')

      const { data: selectedBus, error: busError } = await supabase
        .from('buses')
        .select('*')
        .eq('id', selectedBusId)
        .eq('active', true)
        .single()

      if (busError) throw busError

      if (assignment) {
        const { error: closeError } = await supabase
          .from('driver_vehicle_assignments')
          .update({
            active: false,
            ended_at: new Date().toISOString()
          })
          .eq('id', assignment.id)
          .eq('driver_id', driver.id)

        if (closeError) throw closeError
      }

      const { data: newAssignment, error: newAssignmentError } = await supabase
        .from('driver_vehicle_assignments')
        .insert({
          driver_id: driver.id,
          bus_id: selectedBus.id,
          active: true
        })
        .select(`
          *,
          buses (
            id,
            code,
            plate,
            transport_type,
            route,
            operator_name,
            capacity,
            active
          )
        `)
        .single()

      if (newAssignmentError) throw newAssignmentError

      setAssignment(newAssignment)
      setSelectedBusId(selectedBus.id)
      setShowVehicleModal(false)
      setMessage(`Vehículo actualizado correctamente. Placa: ${selectedBus.plate}`)
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo actualizar el vehículo.')
      if (driver?.id) await loadDriverData(driver.id)
    } finally {
      setSaving(false)
    }
  }

  function formatDate(date) {
    if (!date) return 'Sin fecha'

    return new Date(date).toLocaleString('es-PE', {
      dateStyle: 'short',
      timeStyle: 'medium'
    })
  }

  function getStudentName(alert) {
    return (
      alert.students?.full_name ||
      alert.students?.student_code ||
      'Estudiante'
    )
  }

  function getTransportName(type) {
    const names = {
      sit: 'SIT',
      combi: 'Combi',
      bus: 'Bus',
      taxi: 'Taxi',
      other: 'Otro'
    }

    return names[type] || type || 'No especificado'
  }

  function openLocation(alert) {
    const location =
      alert.latest_location ||
      (alert.last_latitude !== null && alert.last_longitude !== null
        ? {
            latitude: alert.last_latitude,
            longitude: alert.last_longitude
          }
        : alert.initial_latitude !== null &&
            alert.initial_longitude !== null
          ? {
              latitude: alert.initial_latitude,
              longitude: alert.initial_longitude
            }
          : null)

    if (!location) {
      setError('Esta alerta todavía no tiene una ubicación disponible.')
      return
    }

    const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <main className="driver-page">
        <div className="driver-loading">
          <div className="driver-spinner"></div>
          <p>Cargando portal del conductor...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="driver-page">
      <header className="driver-header">
        <div className="driver-brand">
          <div className="driver-logo">🛡️</div>
          <div>
            <strong>SAFE BUS</strong>
            <span>Portal del conductor</span>
          </div>
        </div>

        <button className="driver-logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <section className="driver-content">
        <div className="driver-welcome">
          <div>
            <p className="driver-label">PORTAL DEL CONDUCTOR</p>
            <h1>Bienvenido, {profile?.full_name || 'Conductor'}</h1>
            <p>
              Consulta tu vehículo y atiende las alertas de emergencia
              asociadas a tu unidad.
            </p>
          </div>

          <div className="driver-status">
            <span className="status-dot"></span>
            Cuenta activa
          </div>
        </div>

        {message && (
          <div className="driver-message success">
            ✓ {message}
            <button onClick={() => setMessage('')}>×</button>
          </div>
        )}

        {error && (
          <div className="driver-message error">
            ⚠ {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        <section className="driver-section">
          <div className="driver-section-title">
            <div>
              <p>VEHÍCULO ACTUAL</p>
              <h2>
                {assignment?.buses?.plate || 'Sin vehículo asignado'}
              </h2>
            </div>

            <div className="vehicle-header-actions">
              {assignment?.buses && (
                <div className="vehicle-mini-status">
                  {getTransportName(assignment.buses.transport_type)}
                </div>
              )}

              <button
                className="change-vehicle-button"
                onClick={() => {
                  setError('')
                  setMessage('')
                  setSelectedBusId(assignment?.bus_id || '')
                  setShowVehicleModal(true)
                }}
              >
                Cambiar vehículo
              </button>
            </div>
          </div>

          {assignment?.buses ? (
            <div className="vehicle-summary">
              <div>
                <span>Placa</span>
                <strong>{assignment.buses.plate}</strong>
              </div>

              <div>
                <span>Ruta</span>
                <strong>{assignment.buses.route || 'No registrada'}</strong>
              </div>

              <div>
                <span>Capacidad</span>
                <strong>
                  {assignment.buses.capacity
                    ? `${assignment.buses.capacity} pasajeros`
                    : 'No registrada'}
                </strong>
              </div>
            </div>
          ) : (
            <div className="no-vehicle-warning">
              No tienes un vehículo asignado actualmente.
            </div>
          )}
        </section>

        <section className="alerts-section">
          <div className="alerts-header">
            <div>
              <p>SEGURIDAD</p>
              <h2>Alertas de emergencia</h2>
            </div>

            <div className="alerts-header-actions">
              <button
                className={
                  notificationsEnabled
                    ? 'notification-toggle enabled'
                    : 'notification-toggle'
                }
                onClick={
                  notificationsEnabled
                    ? disableNotifications
                    : enableNotifications
                }
              >
                {notificationsEnabled ? '🔊 Alertas activas' : '🔔 Activar sonido'}
              </button>

              <div className={alerts.length ? 'alert-count active' : 'alert-count'}>
                {alerts.length} activa{alerts.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="alerts-empty">
              <div className="alerts-empty-icon">✓</div>
              <h3>No hay alertas activas</h3>
              <p>
                Cuando un estudiante seleccione tu vehículo y presione el
                botón de emergencia, la alerta aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="alerts-list">
              {alerts.map((alert) => {
                const location =
                  alert.latest_location ||
                  (alert.last_latitude !== null &&
                  alert.last_longitude !== null
                    ? {
                        latitude: alert.last_latitude,
                        longitude: alert.last_longitude
                      }
                    : null)

                return (
                  <article className="alert-card-driver" key={alert.id}>
                    <div className="alert-card-top">
                      <div className="alert-danger-icon">🚨</div>

                      <div className="alert-title">
                        <span className="alert-live">
                          ALERTA ACTIVA
                        </span>
                        <h3>{getStudentName(alert)}</h3>
                        <p>
                          {alert.students?.grade || ''}
                          {alert.students?.section
                            ? ` - ${alert.students.section}`
                            : ''}
                        </p>
                      </div>

                      <span className="alert-time">
                        {formatDate(alert.created_at)}
                      </span>
                    </div>

                    <div className="alert-details">
                      <div>
                        <span>Vehículo</span>
                        <strong>
                          {alert.vehicle_description ||
                            assignment?.buses?.plate ||
                            'No especificado'}
                        </strong>
                      </div>

                      <div>
                        <span>Ruta</span>
                        <strong>
                          {alert.route_description || 'No registrada'}
                        </strong>
                      </div>

                      <div>
                        <span>Ubicación</span>
                        <strong>
                          {location
                            ? `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`
                            : 'Esperando GPS'}
                        </strong>
                      </div>
                    </div>

                    <div className="alert-actions">
                      <button
                        className="alert-location-button"
                        onClick={() => openLocation(alert)}
                        disabled={!location}
                      >
                        Ver ubicación
                      </button>

                      <span className="alert-updating">
                        GPS actualizado cada pocos segundos
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="driver-security">
          <div className="security-icon">🛡️</div>
          <div>
            <h3>¿Cómo funciona una alerta?</h3>
            <p>
              Si un estudiante selecciona tu vehículo registrado y presiona
              el botón de emergencia, SafeBus asociará la alerta contigo.
              La alerta aparecerá automáticamente en este portal junto con
              la información disponible y la ubicación del estudiante.
            </p>
          </div>
        </section>

        {showVehicleModal && (
          <div
            className="driver-modal-overlay"
            onClick={() => {
              if (!saving) setShowVehicleModal(false)
            }}
          >
            <div
              className="driver-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="driver-modal-header">
                <div>
                  <p>VEHÍCULOS</p>
                  <h2>Seleccionar vehículo</h2>
                </div>
                <button
                  className="modal-close"
                  onClick={() => {
                    if (!saving) setShowVehicleModal(false)
                  }}
                >
                  ×
                </button>
              </div>

              <div className="driver-modal-body">
                <p className="modal-description">
                  Selecciona una placa registrada y activa.
                </p>

                {buses.length === 0 ? (
                  <div className="empty-buses">
                    No hay vehículos activos disponibles.
                  </div>
                ) : (
                  <div className="vehicle-options">
                    {buses.map((bus) => (
                      <label
                        key={bus.id}
                        className={
                          selectedBusId === bus.id
                            ? 'vehicle-option selected'
                            : 'vehicle-option'
                        }
                      >
                        <input
                          type="radio"
                          name="vehicle"
                          value={bus.id}
                          checked={selectedBusId === bus.id}
                          onChange={(e) => setSelectedBusId(e.target.value)}
                        />

                        <div className="vehicle-option-icon">🚌</div>

                        <div className="vehicle-option-info">
                          <strong>{bus.plate}</strong>
                          <span>
                            {getTransportName(bus.transport_type)}
                            {bus.route ? ` · ${bus.route}` : ''}
                          </span>
                        </div>

                        {bus.id === assignment?.bus_id && (
                          <span className="current-badge">Actual</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="driver-modal-footer">
                <button
                  className="modal-cancel"
                  onClick={() => {
                    if (!saving) setShowVehicleModal(false)
                  }}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  className="modal-save"
                  onClick={changeVehicle}
                  disabled={
                    saving ||
                    !selectedBusId ||
                    selectedBusId === assignment?.bus_id
                  }
                >
                  {saving ? 'Guardando...' : 'Guardar vehículo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default Conductor

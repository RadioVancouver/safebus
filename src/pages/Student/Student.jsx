import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

import './Student.css'

function Student() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState(null)
  const [error, setError] = useState('')

  const [activeAlert, setActiveAlert] = useState(null)
  const [alertLoading, setAlertLoading] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [locationWarning, setLocationWarning] = useState('')

  // WHATSAPP DE EMERGENCIA
  const [whatsappLinks, setWhatsappLinks] = useState([])

  const [isHolding, setIsHolding] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)

  // CONTACTOS DE EMERGENCIA
  const [emergencyContacts, setEmergencyContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactSaving, setContactSaving] = useState(false)
  const [contactError, setContactError] = useState('')
  const [contactSuccess, setContactSuccess] = useState('')

  const [showContactModal, setShowContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)

  const [contactForm, setContactForm] = useState({
    full_name: '',
    relationship: 'Madre',
    phone: '',
    is_primary: false,
  })

  const holdTimerRef = useRef(null)
  const progressTimerRef = useRef(null)
  const watchIdRef = useRef(null)

  useEffect(() => {
    loadStudent()

    return () => {
      clearHoldTimers()
      stopLocationTracking()
    }
  }, [])

  async function loadStudent() {
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    const { data, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        student_code,
        grade,
        section,
        seat_number,
        active,
        profiles (
          full_name
        ),
        schools (
          name
        )
      `)
      .eq('profile_id', user.id)
      .single()

    if (studentError || !data) {
      console.error(studentError)

      setError(
        'No se encontró un registro de estudiante asociado a esta cuenta.'
      )

      setLoading(false)
      return
    }

    if (!data.active) {
      setError(
        'Esta cuenta de estudiante se encuentra desactivada.'
      )

      setLoading(false)
      return
    }

    setStudent(data)

    await Promise.all([
      loadActiveAlert(data.id),
      loadEmergencyContacts(data.id),
    ])

    setLoading(false)
  }

  async function loadActiveAlert(studentId) {
    const { data, error: alertError } = await supabase
      .from('alerts')
      .select(`
        id,
        student_id,
        type,
        status,
        message,
        created_at,
        last_latitude,
        last_longitude,
        last_location_at
      `)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .order('created_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle()

    if (alertError) {
      console.error(
        'Error cargando alerta:',
        alertError
      )
      return
    }

    if (data) {
      setActiveAlert(data)
      startLocationTracking(data.id)
    }
  }

  // =========================================================
  // CONTACTOS DE EMERGENCIA
  // =========================================================

  async function loadEmergencyContacts(studentId) {
    setContactsLoading(true)
    setContactError('')

    const { data, error: contactsError } = await supabase
      .from('emergency_contacts')
      .select(`
        id,
        student_id,
        full_name,
        relationship,
        phone,
        is_primary,
        active,
        created_at,
        updated_at
      `)
      .eq('student_id', studentId)
      .eq('active', true)
      .order('is_primary', {
        ascending: false,
      })
      .order('created_at', {
        ascending: true,
      })

    if (contactsError) {
      console.error(
        'Error cargando contactos:',
        contactsError
      )

      setContactError(
        'No se pudieron cargar tus contactos de emergencia.'
      )

      setContactsLoading(false)
      return
    }

    setEmergencyContacts(data || [])
    setContactsLoading(false)
  }

  function openAddContactModal() {
    if (emergencyContacts.length >= 2) {
      setContactError(
        'Ya tienes 2 contactos de emergencia. Puedes editar o eliminar uno para agregar otro.'
      )
      return
    }

    setEditingContact(null)

    setContactForm({
      full_name: '',
      relationship: 'Madre',
      phone: '',
      is_primary: emergencyContacts.length === 0,
    })

    setContactError('')
    setContactSuccess('')
    setShowContactModal(true)
  }

  function openEditContactModal(contact) {
    setEditingContact(contact)

    setContactForm({
      full_name: contact.full_name || '',
      relationship: contact.relationship || 'Familiar',
      phone: contact.phone || '',
      is_primary: contact.is_primary === true,
    })

    setContactError('')
    setContactSuccess('')
    setShowContactModal(true)
  }

  function closeContactModal() {
    if (contactSaving) return

    setShowContactModal(false)
    setEditingContact(null)
    setContactError('')
  }

  function handleContactChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target

    setContactForm((previous) => ({
      ...previous,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }))
  }

  async function saveContact(event) {
    event.preventDefault()

    setContactError('')
    setContactSuccess('')

    const name = contactForm.full_name.trim()
    const phone = contactForm.phone.trim()

    if (!name) {
      setContactError(
        'Ingresa el nombre del contacto.'
      )
      return
    }

    if (!phone) {
      setContactError(
        'Ingresa el número de teléfono.'
      )
      return
    }

    if (phone.length < 7) {
      setContactError(
        'Ingresa un número de teléfono válido.'
      )
      return
    }

    if (
      !editingContact &&
      emergencyContacts.length >= 2
    ) {
      setContactError(
        'Solo puedes tener 2 contactos de emergencia.'
      )
      return
    }

    if (!student?.id) {
      setContactError(
        'No se encontró el estudiante.'
      )
      return
    }

    setContactSaving(true)

    try {
      /*
       * Si el contacto será principal,
       * primero quitamos el estado principal
       * de los demás contactos.
       */
      if (contactForm.is_primary) {
        const { error: primaryError } =
          await supabase
            .from('emergency_contacts')
            .update({
              is_primary: false,
            })
            .eq('student_id', student.id)
            .eq('active', true)

        if (primaryError) {
          throw primaryError
        }
      }

      if (editingContact) {
        const {
          error: updateError,
        } = await supabase
          .from('emergency_contacts')
          .update({
            full_name: name,
            relationship:
              contactForm.relationship,
            phone,
            is_primary:
              contactForm.is_primary,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', editingContact.id)
          .eq('student_id', student.id)

        if (updateError) {
          throw updateError
        }

        setContactSuccess(
          'Contacto actualizado correctamente.'
        )
      } else {
        const {
          error: insertError,
        } = await supabase
          .from('emergency_contacts')
          .insert({
            student_id: student.id,
            full_name: name,
            relationship:
              contactForm.relationship,
            phone,
            is_primary:
              contactForm.is_primary,
            active: true,
          })

        if (insertError) {
          throw insertError
        }

        setContactSuccess(
          'Contacto agregado correctamente.'
        )
      }

      await loadEmergencyContacts(student.id)

      setShowContactModal(false)
      setEditingContact(null)
    } catch (err) {
      console.error(
        'Error guardando contacto:',
        err
      )

      setContactError(
        err.message ||
          'No se pudo guardar el contacto.'
      )
    } finally {
      setContactSaving(false)
    }
  }

  async function deleteContact(contact) {
    const confirmed = window.confirm(
      `¿Quieres eliminar a ${contact.full_name} de tus contactos de emergencia?`
    )

    if (!confirmed) {
      return
    }

    setContactError('')
    setContactSuccess('')

    try {
      const {
        error: deleteError,
      } = await supabase
        .from('emergency_contacts')
        .update({
          active: false,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', contact.id)
        .eq('student_id', student.id)

      if (deleteError) {
        throw deleteError
      }

      await loadEmergencyContacts(student.id)

      setContactSuccess(
        'Contacto eliminado correctamente.'
      )
    } catch (err) {
      console.error(
        'Error eliminando contacto:',
        err
      )

      setContactError(
        err.message ||
          'No se pudo eliminar el contacto.'
      )
    }
  }

  async function setPrimaryContact(contact) {
    if (!student?.id) return

    setContactError('')
    setContactSuccess('')

    try {
      const {
        error: resetError,
      } = await supabase
        .from('emergency_contacts')
        .update({
          is_primary: false,
        })
        .eq('student_id', student.id)
        .eq('active', true)

      if (resetError) {
        throw resetError
      }

      const {
        error: primaryError,
      } = await supabase
        .from('emergency_contacts')
        .update({
          is_primary: true,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', contact.id)
        .eq('student_id', student.id)

      if (primaryError) {
        throw primaryError
      }

      await loadEmergencyContacts(student.id)

      setContactSuccess(
        `${contact.full_name} ahora es tu contacto principal.`
      )
    } catch (err) {
      console.error(
        'Error cambiando contacto principal:',
        err
      )

      setContactError(
        err.message ||
          'No se pudo cambiar el contacto principal.'
      )
    }
  }

  // =========================================================
  // ALERTA Y GPS
  // =========================================================

  function clearHoldTimers() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }

  function stopLocationTracking() {
    if (
      watchIdRef.current !== null &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      )

      watchIdRef.current = null
    }
  }

  function startHold() {
    if (
      alertLoading ||
      activeAlert ||
      !student
    ) {
      return
    }

    clearHoldTimers()

    setIsHolding(true)
    setHoldProgress(0)

    const startedAt = Date.now()
    const holdDuration = 1500

    progressTimerRef.current =
      setInterval(() => {
        const elapsed =
          Date.now() - startedAt

        const progress = Math.min(
          100,
          (elapsed / holdDuration) * 100
        )

        setHoldProgress(progress)
      }, 30)

    holdTimerRef.current =
      setTimeout(() => {
        clearHoldTimers()

        setIsHolding(false)
        setHoldProgress(100)

        activateEmergency()
      }, holdDuration)
  }

  function cancelHold() {
    if (
      activeAlert ||
      alertLoading
    ) {
      return
    }

    clearHoldTimers()

    setIsHolding(false)
    setHoldProgress(0)
  }

  async function getCurrentLocation() {
    if (!navigator.geolocation) {
      return null
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(position)
        },
        (error) => {
          console.error(
            'Error obteniendo GPS:',
            error
          )

          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    })
  }

  function createWhatsAppLinks(notificationResult) {
    const shareUrl = notificationResult?.share_link?.url
    const contacts = Array.isArray(notificationResult?.contacts)
      ? notificationResult.contacts
      : []

    if (!shareUrl || contacts.length === 0) {
      setWhatsappLinks([])
      return
    }

    const studentName =
      student?.profiles?.full_name ||
      student?.full_name ||
      'El estudiante'

    const message =
      `🚨 ALERTA SAFEBUS\n\n` +
      `${studentName} ha activado una alerta de emergencia.\n\n` +
      `📍 Puedes consultar su ubicación aquí:\n` +
      `${shareUrl}\n\n` +
      `Este enlace permite consultar la ubicación mientras la alerta esté activa.\n\n` +
      `SafeBus`

    const links = contacts
      .filter((contact) => contact?.phone)
      .map((contact) => {
        const digits = String(contact.phone).replace(/\\D/g, '')
        const normalizedPhone =
          digits.length === 9 ? `51${digits}` : digits

        return {
          id: contact.id || contact.phone,
          name: contact.contact_name || contact.full_name || 'Contacto',
          phone: contact.contact_phone || contact.phone,
          url: `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`,
        }
      })

    setWhatsappLinks(links)
  }

  async function activateEmergency() {
    if (
      !student ||
      activeAlert
    ) {
      return
    }

    setAlertLoading(true)
    setAlertMessage('')
    setLocationWarning('')
    setWhatsappLinks([])

    try {
      console.log('=== SAFEBUS: ACTIVANDO EMERGENCIA ===')
      console.log('Estudiante:', student?.id)

      const position =
        await getCurrentLocation()

      let latitude = null
      let longitude = null
      let accuracy = null

      if (position) {
        latitude =
          position.coords.latitude

        longitude =
          position.coords.longitude

        accuracy =
          position.coords.accuracy
      } else {
        setLocationWarning(
          'La alerta se activó, pero el navegador no permitió obtener tu ubicación.'
        )
      }

      /*
       * Crear alerta
       */

      const {
        data: alert,
        error: alertError,
      } = await supabase
        .from('alerts')
        .insert({
          student_id: student.id,
          type: 'emergency',
          status: 'active',
          message:
            'Alerta de emergencia activada desde SafeBus.',
          initial_latitude: latitude,
          initial_longitude: longitude,
          last_latitude: latitude,
          last_longitude: longitude,
          last_location_at: position
            ? new Date().toISOString()
            : null,
        })
        .select(`
          id,
          student_id,
          type,
          status,
          message,
          created_at,
          last_latitude,
          last_longitude,
          last_location_at
        `)
        .single()

      if (
        alertError ||
        !alert
      ) {
        console.error(
          'Error creando alerta:',
          alertError
        )

        throw new Error(
          alertError?.message ||
            'No se pudo activar la alerta.'
        )
      }

      console.log('=== SAFEBUS: ALERTA CREADA ===')
      console.log('Alert ID:', alert.id)
      console.log('Llamando a notify-emergency-contacts...')

      /*
       * =====================================================
       * NOTIFICAR CONTACTOS DE EMERGENCIA
       * =====================================================
       *
       * La alerta ya fue creada correctamente.
       *
       * La Edge Function:
       * - verifica al estudiante
       * - verifica la alerta
       * - busca hasta 2 contactos
       * - genera un enlace seguro
       * - registra las notificaciones
       *
       * Si la notificación falla, la alerta NO se cancela.
       */

      const {
        data: notificationResult,
        error: notificationError,
      } = await supabase.functions.invoke(
        'notify-emergency-contacts',
        {
          body: {
            alert_id: alert.id,
          },
        }
      )

      console.log('=== SAFEBUS: RESPUESTA DE EDGE FUNCTION ===')
      console.log('notificationResult:', notificationResult)
      console.log('notificationError:', notificationError)

      if (notificationError) {
        console.error(
          'Error notificando contactos de emergencia:',
          notificationError
        )

        setLocationWarning(
          'La alerta está activa, pero no se pudo preparar la notificación a tus contactos.'
        )
      } else {
        console.log(
          'Resultado de notificaciones:',
          notificationResult
        )

        if (
          notificationResult?.share_link?.url
        ) {
          console.log(
            'Enlace seguro generado:',
            notificationResult.share_link.url
          )

          createWhatsAppLinks(notificationResult)
        }
      }

      /*
       * Guardar primera ubicación
       */

      if (position) {
        const {
          error: locationError,
        } = await supabase
          .from('alert_locations')
          .insert({
            alert_id: alert.id,
            latitude,
            longitude,
            accuracy,
            recorded_at:
              new Date().toISOString(),
          })

        if (locationError) {
          console.error(
            'Error guardando primera ubicación:',
            locationError
          )
        }
      }

      setActiveAlert(alert)

      setAlertMessage(
        'Alerta activa. Tu ubicación está siendo registrada.'
      )

      startLocationTracking(alert.id)
    } catch (error) {
      console.error(
        'Error activando emergencia:',
        error
      )

      setAlertMessage(
        error.message ||
          'No se pudo activar la alerta.'
      )
    } finally {
      setAlertLoading(false)
      setHoldProgress(0)
    }
  }

  function startLocationTracking(alertId) {
    if (!navigator.geolocation) {
      setLocationWarning(
        'Este navegador no permite obtener ubicación GPS.'
      )

      return
    }

    if (
      watchIdRef.current !== null
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      )
    }

    watchIdRef.current =
      navigator.geolocation.watchPosition(
        async (position) => {
          const latitude =
            position.coords.latitude

          const longitude =
            position.coords.longitude

          const accuracy =
            position.coords.accuracy

          const recordedAt =
            new Date().toISOString()

          /*
           * Guardar ubicación
           */

          const {
            error: locationError,
          } = await supabase
            .from('alert_locations')
            .insert({
              alert_id: alertId,
              latitude,
              longitude,
              accuracy,
              recorded_at:
                recordedAt,
            })

          if (locationError) {
            console.error(
              'Error guardando ubicación:',
              locationError
            )
          }

          /*
           * Actualizar última ubicación
           */

          const {
            error: alertError,
          } = await supabase
            .from('alerts')
            .update({
              last_latitude: latitude,
              last_longitude: longitude,
              last_location_at:
                recordedAt,
            })
            .eq('id', alertId)
            .eq('status', 'active')

          if (alertError) {
            console.error(
              'Error actualizando última ubicación:',
              alertError
            )
          }

          setActiveAlert(
            (current) => {
              if (!current) {
                return current
              }

              return {
                ...current,
                last_latitude:
                  latitude,
                last_longitude:
                  longitude,
                last_location_at:
                  recordedAt,
              }
            }
          )
        },
        (locationError) => {
          console.error(
            'GPS error:',
            locationError
          )

          setLocationWarning(
            'No se pudo actualizar la ubicación GPS.'
          )
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      )
  }

  async function resolveAlert() {
    if (
      !activeAlert ||
      alertLoading
    ) {
      return
    }

    const confirmed =
      window.confirm(
        '¿Confirmas que estás a salvo?'
      )

    if (!confirmed) {
      return
    }

    setAlertLoading(true)

    const {
      error: updateError,
    } = await supabase
      .from('alerts')
      .update({
        status: 'resolved',
        resolved_at:
          new Date().toISOString(),
      })
      .eq('id', activeAlert.id)
      .eq('status', 'active')

    if (updateError) {
      console.error(
        'Error cerrando alerta:',
        updateError
      )

      setAlertMessage(
        'No se pudo cerrar la alerta. Intenta nuevamente.'
      )

      setAlertLoading(false)

      return
    }

    stopLocationTracking()

    setActiveAlert(null)
    setWhatsappLinks([])

    setAlertMessage(
      'Alerta finalizada. Se registró que estás a salvo.'
    )

    setLocationWarning('')

    setAlertLoading(false)
  }

  async function handleLogout() {
    stopLocationTracking()

    await supabase.auth.signOut()

    navigate('/login', {
      replace: true,
    })
  }

  // =========================================================
  // PANTALLA
  // =========================================================

  if (loading) {
    return (
      <main className="student-loading-page">
        <div className="student-loading-card">
          <div className="student-loading-icon">
            🛡️
          </div>

          <p>
            Cargando SafeBus...
          </p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="student-error-page">
        <div className="student-error-card">
          <div className="student-error-icon">
            ⚠️
          </div>

          <h1>
            No se pudo cargar SafeBus
          </h1>

          <p>
            {error}
          </p>

          <button
            className="student-back-button"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="student-page">

      <header className="student-header">

        <div className="student-brand">

          <div className="student-logo">
            🛡️
          </div>

          <div>
            <strong>
              SAFE BUS
            </strong>

            <span>
              Seguridad en el transporte
            </span>
          </div>

        </div>

        <button
          className="student-logout"
          onClick={handleLogout}
        >
          Cerrar sesión
        </button>

      </header>


      <section className="student-content">

        <div className="student-welcome">

          <p className="student-label">
            SISTEMA DE SEGURIDAD
          </p>

          <h1>
            Hola,{' '}
            {student.profiles?.full_name ||
              'estudiante'}
          </h1>

          <p>
            SafeBus te permite solicitar ayuda
            rápidamente si tienes una situación
            de riesgo durante tu viaje.
          </p>

        </div>


        {!activeAlert ? (

          <section className="emergency-card">

            <div className="emergency-icon">
              🚨
            </div>

            <h2>
              ¿Estás en peligro?
            </h2>

            <p className="emergency-description">
              Si estás siendo víctima de acoso,
              tienes una emergencia o necesitas
              ayuda, activa una alerta.
            </p>

            <button
              className={`emergency-button ${
                isHolding
                  ? 'emergency-button-holding'
                  : ''
              }`}
              type="button"
              disabled={alertLoading}
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
            >

              <span>
                🚨
              </span>

              <strong>
                {alertLoading
                  ? 'ACTIVANDO...'
                  : 'MANTÉN PRESIONADO'}
              </strong>

              {!alertLoading &&
                isHolding && (
                  <small>
                    {Math.round(
                      holdProgress
                    )}
                    %
                  </small>
                )}

            </button>

            <p className="emergency-help">
              Mantén presionado durante
              1.5 segundos para activar
              la alerta.
            </p>

          </section>

        ) : (

          <section className="emergency-card emergency-active">

            <div className="emergency-icon">
              🚨
            </div>

            <div className="active-alert-badge">
              ALERTA ACTIVA
            </div>

            <h2>
              Tu alerta está activa
            </h2>

            <p className="emergency-description">
              SafeBus está registrando tu
              ubicación para facilitar la
              atención de la emergencia.
            </p>

            {whatsappLinks.length > 0 && (
              <div className="whatsapp-emergency-box">
                <div className="whatsapp-emergency-title">
                  <span>📲</span>
                  <div>
                    <strong>Enviar alerta por WhatsApp</strong>
                    <p>
                      El mensaje ya está preparado. Solo debes
                      abrir WhatsApp y presionar Enviar.
                    </p>
                  </div>
                </div>

                <div className="whatsapp-contact-list">
                  {whatsappLinks.map((contact) => (
                    <a
                      key={contact.id}
                      className="whatsapp-contact-button"
                      href={contact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>WhatsApp</span>
                      <strong>{contact.name}</strong>
                      <small>{contact.phone}</small>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="alert-status-box">

              <div>
                <span>
                  Estado
                </span>

                <strong>
                  En atención
                </strong>
              </div>

              <div>
                <span>
                  Ubicación
                </span>

                <strong>
                  {activeAlert.last_latitude
                    ? 'GPS actualizado'
                    : 'Esperando GPS'}
                </strong>
              </div>

            </div>

            <button
              className="safe-button"
              type="button"
              disabled={alertLoading}
              onClick={resolveAlert}
            >
              ✓ ESTOY A SALVO
            </button>

            <p className="emergency-help">
              Presiona este botón solamente
              cuando estés fuera de peligro.
            </p>

          </section>

        )}


        {alertMessage && (
          <div className="student-alert-message">

            <span>
              ℹ️
            </span>

            <p>
              {alertMessage}
            </p>

          </div>
        )}


        {locationWarning && (
          <div className="student-location-warning">

            <span>
              📍
            </span>

            <p>
              {locationWarning}
            </p>

          </div>
        )}


        {/* =================================================
            MI INFORMACIÓN
        ================================================= */}

        <section className="student-info">

          <div className="info-header">

            <h2>
              Mi información
            </h2>

          </div>

          <div className="info-grid">

            <div className="info-item">

              <span>
                Nombre
              </span>

              <strong>
                {student.profiles?.full_name ||
                  '—'}
              </strong>

            </div>


            <div className="info-item">

              <span>
                Código
              </span>

              <strong>
                {student.student_code ||
                  '—'}
              </strong>

            </div>


            <div className="info-item">

              <span>
                Institución
              </span>

              <strong>
                {student.schools?.name ||
                  '—'}
              </strong>

            </div>


            <div className="info-item">

              <span>
                Grado / sección
              </span>

              <strong>
                {student.grade ||
                  '—'}

                {student.section
                  ? ` - ${student.section}`
                  : ''}
              </strong>

            </div>

          </div>

        </section>


        {/* =================================================
            CONTACTOS DE EMERGENCIA
        ================================================= */}

        <section className="student-info emergency-contacts-section">

          <div className="info-header emergency-contacts-header">

            <div>
              <h2>
                Contactos de emergencia
              </h2>

              <p className="contacts-description">
                Personas de confianza que podrán
                ser contactadas si tienes una
                emergencia.
              </p>
            </div>

            {emergencyContacts.length < 2 && (
              <button
                type="button"
                className="add-contact-button"
                onClick={openAddContactModal}
              >
                + Agregar contacto
              </button>
            )}

          </div>


          {contactsLoading ? (

            <div className="contacts-loading">
              Cargando contactos...
            </div>

          ) : emergencyContacts.length === 0 ? (

            <div className="contacts-empty">

              <div className="contacts-empty-icon">
                📞
              </div>

              <h3>
                Aún no tienes contactos de emergencia
              </h3>

              <p>
                Registra al menos una persona de
                confianza para que SafeBus pueda
                contactarla ante una emergencia.
              </p>

              <button
                type="button"
                className="add-contact-button"
                onClick={openAddContactModal}
              >
                + Agregar contacto
              </button>

            </div>

          ) : (

            <div className="contacts-list">

              {emergencyContacts.map(
                (contact, index) => (

                  <div
                    className={`emergency-contact-card ${
                      contact.is_primary
                        ? 'primary-contact'
                        : ''
                    }`}
                    key={contact.id}
                  >

                    <div className="contact-main">

                      <div className="contact-avatar">
                        {index === 0
                          ? '👤'
                          : '👥'}
                      </div>

                      <div className="contact-data">

                        <div className="contact-name-row">

                          <strong>
                            {contact.full_name}
                          </strong>

                          {contact.is_primary && (
                            <span className="primary-badge">
                              ★ Principal
                            </span>
                          )}

                        </div>

                        <span className="contact-relationship">
                          {contact.relationship}
                        </span>

                        <span className="contact-phone">
                          📞 {contact.phone}
                        </span>

                      </div>

                    </div>


                    <div className="contact-actions">

                      {!contact.is_primary && (
                        <button
                          type="button"
                          className="contact-action secondary"
                          onClick={() =>
                            setPrimaryContact(
                              contact
                            )
                          }
                        >
                          ★ Principal
                        </button>
                      )}

                      <button
                        type="button"
                        className="contact-action"
                        onClick={() =>
                          openEditContactModal(
                            contact
                          )
                        }
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="contact-action danger"
                        onClick={() =>
                          deleteContact(
                            contact
                          )
                        }
                      >
                        Eliminar
                      </button>

                    </div>

                  </div>

                )
              )}

            </div>

          )}


          {emergencyContacts.length === 2 && (
            <div className="contacts-limit">
              ✓ Tienes registrados tus 2 contactos
              de emergencia.
            </div>
          )}

          {contactSuccess && (
            <div className="contact-success">
              ✓ {contactSuccess}
            </div>
          )}

          {contactError && !showContactModal && (
            <div className="contact-error">
              {contactError}
            </div>
          )}

        </section>


        <div className="student-security-note">

          <span>
            🔒
          </span>

          <p>
            Tu información y ubicación
            solamente podrán ser consultadas
            por usuarios autorizados.
          </p>

        </div>

      </section>


      {/* ===================================================
          MODAL CONTACTO
      =================================================== */}

      {showContactModal && (

        <div className="contact-modal-overlay">

          <div className="contact-modal">

            <div className="contact-modal-header">

              <div>
                <span className="student-label">
                  SAFEBUS
                </span>

                <h2>
                  {editingContact
                    ? 'Editar contacto'
                    : 'Nuevo contacto'}
                </h2>
              </div>

              <button
                type="button"
                className="contact-modal-close"
                onClick={closeContactModal}
                disabled={contactSaving}
              >
                ×
              </button>

            </div>


            <form
              className="contact-form"
              onSubmit={saveContact}
            >

              <div className="contact-form-group">

                <label>
                  Nombre completo
                </label>

                <input
                  type="text"
                  name="full_name"
                  value={
                    contactForm.full_name
                  }
                  onChange={
                    handleContactChange
                  }
                  placeholder="Ej. María Mendoza"
                  disabled={contactSaving}
                />

              </div>


              <div className="contact-form-group">

                <label>
                  Relación
                </label>

                <select
                  name="relationship"
                  value={
                    contactForm.relationship
                  }
                  onChange={
                    handleContactChange
                  }
                  disabled={contactSaving}
                >

                  <option value="Madre">
                    Madre
                  </option>

                  <option value="Padre">
                    Padre
                  </option>

                  <option value="Abuela">
                    Abuela
                  </option>

                  <option value="Abuelo">
                    Abuelo
                  </option>

                  <option value="Hermano/a">
                    Hermano/a
                  </option>

                  <option value="Tutor/a">
                    Tutor/a
                  </option>

                  <option value="Familiar">
                    Familiar
                  </option>

                  <option value="Persona de confianza">
                    Persona de confianza
                  </option>

                </select>

              </div>


              <div className="contact-form-group">

                <label>
                  Número de teléfono
                </label>

                <input
                  type="tel"
                  name="phone"
                  value={
                    contactForm.phone
                  }
                  onChange={
                    handleContactChange
                  }
                  placeholder="987654321"
                  inputMode="tel"
                  disabled={contactSaving}
                />

              </div>


              <label className="primary-contact-checkbox">

                <input
                  type="checkbox"
                  name="is_primary"
                  checked={
                    contactForm.is_primary
                  }
                  onChange={
                    handleContactChange
                  }
                  disabled={contactSaving}
                />

                <span>
                  Establecer como contacto principal
                </span>

              </label>


              {contactError && (
                <div className="contact-error">
                  {contactError}
                </div>
              )}


              <div className="contact-form-actions">

                <button
                  type="button"
                  className="contact-cancel-button"
                  onClick={closeContactModal}
                  disabled={contactSaving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="contact-save-button"
                  disabled={contactSaving}
                >
                  {contactSaving
                    ? 'Guardando...'
                    : editingContact
                      ? 'Guardar cambios'
                      : 'Agregar contacto'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </main>
  )
}

export default Student
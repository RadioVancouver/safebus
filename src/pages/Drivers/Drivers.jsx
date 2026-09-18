import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import './Drivers.css'

function Drivers() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [drivers, setDrivers] = useState([])
  const [buses, setBuses] = useState([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [editingDriver, setEditingDriver] = useState(null)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    license_number: '',
    email: '',
    password: '',
    active: true,
    bus_id: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [driversResult, busesResult] = await Promise.all([
        supabase
          .from('drivers')
          .select(`
            id,
            profile_id,
            license_number,
            profiles (
              full_name,
              phone,
              active
            ),
            driver_vehicle_assignments (
              id,
              bus_id,
              assigned_at,
              ended_at,
              active,
              buses (
                id,
                code,
                plate,
                transport_type,
                route,
                operator_name,
                active
              )
            )
          `)
          .order('license_number', { ascending: true }),

        supabase
          .from('buses')
          .select(`
            id,
            code,
            plate,
            transport_type,
            route,
            operator_name,
            active
          `)
          .eq('active', true)
          .order('plate', { ascending: true }),
      ])

      if (driversResult.error) throw driversResult.error
      if (busesResult.error) throw busesResult.error

      setDrivers(driversResult.data || [])
      setBuses(busesResult.data || [])
    } catch (err) {
      console.error('Error cargando conductores:', err)
      setError(err.message || 'No se pudieron cargar los conductores.')
    } finally {
      setLoading(false)
    }
  }

  function getDriverName(driver) {
    return driver.profiles?.full_name || 'Sin cuenta de acceso'
  }

  function getDriverPhone(driver) {
    return driver.profiles?.phone || '—'
  }

  function getCurrentAssignment(driver) {
    const assignments = Array.isArray(driver.driver_vehicle_assignments)
      ? driver.driver_vehicle_assignments
      : []

    return (
      assignments.find(
        (assignment) =>
          assignment.active === true &&
          assignment.ended_at === null &&
          assignment.buses?.active === true
      ) || null
    )
  }

  function getVehicleLabel(bus) {
    if (!bus) return 'Sin vehículo'

    const parts = [
      bus.plate,
      bus.route ? `Ruta ${bus.route}` : null,
      bus.operator_name || null,
    ].filter(Boolean)

    return parts.join(' · ')
  }

  function getTransportLabel(type) {
    const labels = {
      combi: 'Combi',
      bus: 'Bus',
      sit: 'SIT',
      taxi: 'Taxi',
      other: 'Otro',
    }

    return labels[type] || type || '—'
  }

  const filteredDrivers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return drivers.filter((driver) => {
      const name = getDriverName(driver).toLowerCase()
      const phone = getDriverPhone(driver).toLowerCase()
      const license = String(driver.license_number || '').toLowerCase()
      const assignment = getCurrentAssignment(driver)
      const plate = String(assignment?.buses?.plate || '').toLowerCase()

      const matchesSearch =
        !query ||
        name.includes(query) ||
        phone.includes(query) ||
        license.includes(query) ||
        plate.includes(query)

      const driverActive =
        driver.profiles?.active !== false

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && driverActive) ||
        (statusFilter === 'inactive' && !driverActive)

      return matchesSearch && matchesStatus
    })
  }, [drivers, search, statusFilter])

  function resetForm() {
    setForm({
      full_name: '',
      phone: '',
      license_number: '',
      email: '',
      password: '',
      active: true,
      bus_id: '',
    })
    setEditingDriver(null)
  }

  function openAddModal() {
    resetForm()
    setError('')
    setSuccess('')
    setShowModal(true)
  }

  function openEditModal(driver) {
    const assignment = getCurrentAssignment(driver)

    setEditingDriver(driver)
    setForm({
      full_name: getDriverName(driver) === 'Sin cuenta de acceso'
        ? ''
        : getDriverName(driver),
      phone: getDriverPhone(driver) === '—'
        ? ''
        : getDriverPhone(driver),
      license_number: driver.license_number || '',
      email: '',
      password: '',
      active: driver.profiles?.active !== false,
      bus_id: assignment?.bus_id || '',
    })

    setError('')
    setSuccess('')
    setShowModal(true)
  }

  function closeModal() {
    if (saving) return

    setShowModal(false)
    resetForm()
    setError('')
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function saveDriver(event) {
    event.preventDefault()

    setError('')
    setSuccess('')

    const fullName = form.full_name.trim()
    const phone = form.phone.trim()
    const license = form.license_number.trim().toUpperCase()
    const email = form.email.trim().toLowerCase()
    const password = form.password

    if (!fullName) {
      setError('Ingresa el nombre completo del conductor.')
      return
    }

    if (!license) {
      setError('Ingresa el número de licencia.')
      return
    }

    if (!editingDriver) {
      if (!email) {
        setError('Ingresa el correo electrónico del conductor.')
        return
      }

      if (!password || password.length < 6) {
        setError('La contraseña temporal debe tener al menos 6 caracteres.')
        return
      }

      if (!form.bus_id) {
        setError('Selecciona la placa del vehículo que tendrá asignado.')
        return
      }
    }

    setSaving(true)

    try {
      let driverId = editingDriver?.id || null

      if (editingDriver) {
        const profileId = editingDriver.profile_id

        if (profileId) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              full_name: fullName,
              phone: phone || null,
              active: form.active,
            })
            .eq('id', profileId)

          if (profileError) throw profileError
        }

        const { error: driverError } = await supabase
          .from('drivers')
          .update({
            license_number: license,
          })
          .eq('id', editingDriver.id)

        if (driverError) throw driverError

        await saveAssignment(driverId, form.bus_id || null)

        await loadData()
        setShowModal(false)
        resetForm()
        setSuccess('Conductor actualizado correctamente.')
        return
      }

      const { data: functionData, error: functionError } =
        await supabase.functions.invoke('create-driver-account', {
          body: {
            full_name: fullName,
            phone: phone || null,
            license_number: license,
            email,
            password,
          },
        })

      if (functionError) {
        let message = functionError.message

        try {
          const response = functionError.context
          if (response && typeof response.json === 'function') {
            const payload = await response.json()
            if (payload?.error) message = payload.error
          }
        } catch {
          // Conservamos el mensaje original.
        }

        throw new Error(
          message || 'No se pudo crear la cuenta del conductor.'
        )
      }

      if (!functionData?.success || !functionData?.driver?.id) {
        throw new Error(
          functionData?.error ||
            'La cuenta fue procesada, pero no se recibió el conductor creado.'
        )
      }

      driverId = functionData.driver.id

      await saveAssignment(driverId, form.bus_id)

      await loadData()
      setShowModal(false)
      resetForm()

      setSuccess(
        'Conductor registrado correctamente con su cuenta y vehículo asignado.'
      )
    } catch (err) {
      console.error('Error guardando conductor:', err)
      setError(
        err.message ||
          'No se pudo guardar el conductor.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function saveAssignment(driverId, busId) {
    const { data: currentAssignments, error: assignmentReadError } =
      await supabase
        .from('driver_vehicle_assignments')
        .select(`
          id,
          bus_id,
          active,
          ended_at
        `)
        .eq('driver_id', driverId)
        .eq('active', true)

    if (assignmentReadError) throw assignmentReadError

    const current = (currentAssignments || []).find(
      (assignment) => assignment.ended_at === null
    )

    if (!busId) {
      if (current) {
        const { error } = await supabase
          .from('driver_vehicle_assignments')
          .update({
            active: false,
            ended_at: new Date().toISOString(),
          })
          .eq('id', current.id)

        if (error) throw error
      }

      return
    }

    /*
     * Un vehículo no debería quedar asignado simultáneamente
     * a dos conductores activos.
     */
    const { data: vehicleAssignments, error: vehicleReadError } =
      await supabase
        .from('driver_vehicle_assignments')
        .select(`
          id,
          driver_id,
          active,
          ended_at
        `)
        .eq('bus_id', busId)
        .eq('active', true)

    if (vehicleReadError) throw vehicleReadError

    const otherAssignment = (vehicleAssignments || []).find(
      (assignment) =>
        assignment.driver_id !== driverId &&
        assignment.ended_at === null
    )

    if (otherAssignment) {
      throw new Error(
        'Este vehículo ya está asignado a otro conductor activo.'
      )
    }

    if (current && current.bus_id === busId) {
      return
    }

    if (current) {
      const { error } = await supabase
        .from('driver_vehicle_assignments')
        .update({
          active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', current.id)

      if (error) throw error
    }

    const { error: insertError } = await supabase
      .from('driver_vehicle_assignments')
      .insert({
        driver_id: driverId,
        bus_id: busId,
        assigned_at: new Date().toISOString(),
        active: true,
        ended_at: null,
      })

    if (insertError) throw insertError
  }

  async function removeAssignment(driver) {
    const assignment = getCurrentAssignment(driver)

    if (!assignment) return

    const confirmed = window.confirm(
      `¿Quieres quitar el vehículo ${assignment.buses?.plate || ''} de ${getDriverName(driver)}?`
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      const { error: updateError } = await supabase
        .from('driver_vehicle_assignments')
        .update({
          active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', assignment.id)

      if (updateError) throw updateError

      await loadData()
      setSuccess('Vehículo retirado de la asignación.')
    } catch (err) {
      console.error('Error quitando vehículo:', err)
      setError(
        err.message ||
          'No se pudo quitar el vehículo.'
      )
    }
  }

  async function toggleDriverStatus(driver) {
    if (!driver.profile_id) {
      setError(
        'Este conductor todavía no tiene una cuenta de acceso asociada.'
      )
      return
    }

    const currentActive = driver.profiles?.active !== false
    const nextActive = !currentActive

    const confirmed = window.confirm(
      nextActive
        ? `¿Quieres activar a ${getDriverName(driver)}?`
        : `¿Quieres desactivar a ${getDriverName(driver)}?`
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          active: nextActive,
        })
        .eq('id', driver.profile_id)

      if (profileError) throw profileError

      if (!nextActive) {
        const assignment = getCurrentAssignment(driver)

        if (assignment) {
          const { error: assignmentError } = await supabase
            .from('driver_vehicle_assignments')
            .update({
              active: false,
              ended_at: new Date().toISOString(),
            })
            .eq('id', assignment.id)

          if (assignmentError) throw assignmentError
        }
      }

      await loadData()

      setSuccess(
        nextActive
          ? 'Conductor activado.'
          : 'Conductor desactivado y vehículo liberado.'
      )
    } catch (err) {
      console.error('Error cambiando estado:', err)
      setError(
        err.message ||
          'No se pudo cambiar el estado del conductor.'
      )
    }
  }

  function goBack() {
    navigate('/admin')
  }

  if (loading) {
    return (
      <main className="drivers-page">
        <div className="drivers-loading">
          <div className="drivers-loading-icon">🚌</div>
          <h2>Cargando conductores...</h2>
          <p>Consultando conductores y vehículos registrados.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="drivers-page">
      <header className="drivers-header">
        <div className="drivers-header-left">
          <button
            type="button"
            className="drivers-back-button"
            onClick={goBack}
          >
            ←
          </button>

          <div>
            <span className="drivers-eyebrow">SAFE BUS</span>
            <h1>Conductores</h1>
            <p>Registro y asignación de vehículos</p>
          </div>
        </div>

        <button
          type="button"
          className="drivers-add-button"
          onClick={openAddModal}
        >
          + Registrar conductor
        </button>
      </header>

      <section className="drivers-content">
        {error && (
          <div className="drivers-message drivers-message-error">
            <span>⚠️</span>
            <p>{error}</p>
            <button type="button" onClick={() => setError('')}>
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="drivers-message drivers-message-success">
            <span>✓</span>
            <p>{success}</p>
            <button type="button" onClick={() => setSuccess('')}>
              ×
            </button>
          </div>
        )}

        <section className="drivers-summary">
          <div className="summary-card">
            <span>Conductores</span>
            <strong>{drivers.length}</strong>
          </div>

          <div className="summary-card">
            <span>Activos</span>
            <strong>
              {
                drivers.filter(
                  (driver) => driver.profiles?.active !== false
                ).length
              }
            </strong>
          </div>

          <div className="summary-card">
            <span>Con vehículo</span>
            <strong>
              {
                drivers.filter(
                  (driver) => getCurrentAssignment(driver)
                ).length
              }
            </strong>
          </div>

          <div className="summary-card">
            <span>Vehículos disponibles</span>
            <strong>{buses.length}</strong>
          </div>
        </section>

        <section className="drivers-panel">
          <div className="drivers-panel-header">
            <div>
              <h2>Registro de conductores</h2>
              <p>
                Los vehículos se seleccionan desde el registro existente.
              </p>
            </div>

            <button
              type="button"
              className="drivers-refresh-button"
              onClick={loadData}
            >
              ↻ Actualizar
            </button>
          </div>

          <div className="drivers-filters">
            <div className="drivers-search">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Buscar por nombre, licencia o placa..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          {filteredDrivers.length === 0 ? (
            <div className="drivers-empty">
              <div>🚌</div>
              <h3>
                {drivers.length === 0
                  ? 'Aún no hay conductores registrados'
                  : 'No se encontraron conductores'}
              </h3>
              <p>
                {drivers.length === 0
                  ? 'Registra el primer conductor para comenzar a asociar vehículos.'
                  : 'Prueba con otro nombre, licencia o placa.'}
              </p>

              {drivers.length === 0 && (
                <button
                  type="button"
                  className="drivers-add-button"
                  onClick={openAddModal}
                >
                  + Registrar conductor
                </button>
              )}
            </div>
          ) : (
            <div className="drivers-table-wrapper">
              <table className="drivers-table">
                <thead>
                  <tr>
                    <th>Conductor</th>
                    <th>Licencia</th>
                    <th>Vehículo actual</th>
                    <th>Cuenta</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDrivers.map((driver) => {
                    const assignment = getCurrentAssignment(driver)
                    const isActive =
                      driver.profiles?.active !== false

                    return (
                      <tr key={driver.id}>
                        <td>
                          <div className="driver-person">
                            <div className="driver-avatar">
                              {getDriverName(driver)
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>{getDriverName(driver)}</strong>
                              <span>{getDriverPhone(driver)}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="license-badge">
                            {driver.license_number || '—'}
                          </span>
                        </td>

                        <td>
                          {assignment?.buses ? (
                            <div className="assigned-vehicle">
                              <strong>
                                {assignment.buses.plate}
                              </strong>
                              <span>
                                {getTransportLabel(
                                  assignment.buses.transport_type
                                )}
                                {assignment.buses.route
                                  ? ` · Ruta ${assignment.buses.route}`
                                  : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="no-assignment">
                              Sin vehículo
                            </span>
                          )}
                        </td>

                        <td>
                          {driver.profile_id ? (
                            <span className="account-status account-active">
                              Cuenta activa
                            </span>
                          ) : (
                            <span className="account-status account-none">
                              Sin cuenta
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`status-pill ${
                              isActive
                                ? 'status-active'
                                : 'status-inactive'
                            }`}
                          >
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>

                        <td>
                          <div className="driver-actions">
                            <button
                              type="button"
                              onClick={() => openEditModal(driver)}
                            >
                              Editar
                            </button>

                            {assignment && (
                              <button
                                type="button"
                                className="secondary-action"
                                onClick={() =>
                                  removeAssignment(driver)
                                }
                              >
                                Quitar vehículo
                              </button>
                            )}

                            {driver.profile_id && (
                              <button
                                type="button"
                                className={
                                  isActive
                                    ? 'danger-action'
                                    : 'activate-action'
                                }
                                onClick={() =>
                                  toggleDriverStatus(driver)
                                }
                              >
                                {isActive
                                  ? 'Desactivar'
                                  : 'Activar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="drivers-note">
          <span>🔗</span>
          <p>
            Cuando un estudiante seleccione una placa durante una
            emergencia, SafeBus podrá utilizar esta asignación para
            identificar al conductor correspondiente.
          </p>
        </div>
      </section>

      {showModal && (
        <div className="drivers-modal-overlay">
          <div className="drivers-modal">
            <div className="drivers-modal-header">
              <div>
                <span className="drivers-eyebrow">SAFE BUS</span>
                <h2>
                  {editingDriver
                    ? 'Editar conductor'
                    : 'Registrar conductor'}
                </h2>
              </div>

              <button
                type="button"
                className="drivers-modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              className="drivers-form"
              onSubmit={saveDriver}
            >
              <div className="drivers-form-group">
                <label htmlFor="full_name">
                  Nombre completo
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  value={form.full_name}
                  onChange={handleChange}
                  placeholder="Ej. Juan Pérez"
                  disabled={saving}
                />
              </div>

              <div className="drivers-form-row">
                <div className="drivers-form-group">
                  <label htmlFor="phone">
                    Teléfono
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="987654321"
                    inputMode="tel"
                    disabled={saving}
                  />
                </div>

                <div className="drivers-form-group">
                  <label htmlFor="license_number">
                    Número de licencia
                  </label>
                  <input
                    id="license_number"
                    name="license_number"
                    type="text"
                    value={form.license_number}
                    onChange={handleChange}
                    placeholder="Ej. Q12345678"
                    autoCapitalize="characters"
                    disabled={saving}
                  />
                </div>
              </div>

              {!editingDriver && (
                <>
                  <div className="drivers-form-group">
                    <label htmlFor="email">
                      Correo electrónico
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="Ej. juan.perez@safebus.pe"
                      autoComplete="email"
                      disabled={saving}
                    />
                  </div>

                  <div className="drivers-form-group">
                    <label htmlFor="password">
                      Contraseña temporal
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      disabled={saving}
                    />
                    <small>
                      Entrega estas credenciales al conductor para su primer acceso.
                    </small>
                  </div>
                </>
              )}

              <div className="drivers-form-group">
                <label htmlFor="bus_id">
                  Placa del vehículo
                </label>

                <select
                  id="bus_id"
                  name="bus_id"
                  value={form.bus_id}
                  onChange={handleChange}
                  disabled={saving}
                >
                  <option value="">
                    — Sin vehículo asignado —
                  </option>

                  {buses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {getVehicleLabel(bus)}
                    </option>
                  ))}
                </select>

                <small>
                  Solo aparecen vehículos activos registrados en SafeBus.
                </small>
              </div>

              <label className="drivers-active-checkbox">
                <input
                  type="checkbox"
                  name="active"
                  checked={form.active}
                  onChange={handleChange}
                  disabled={saving}
                />
                <span>
                  Conductor activo
                </span>
              </label>

              {error && (
                <div className="drivers-form-error">
                  {error}
                </div>
              )}

              <div className="drivers-form-actions">
                <button
                  type="button"
                  className="drivers-cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="drivers-save-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Guardando...'
                    : editingDriver
                      ? 'Guardar cambios'
                      : 'Registrar conductor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default Drivers

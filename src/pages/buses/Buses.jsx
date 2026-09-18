import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import './Buses.css'

function Buses() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [buses, setBuses] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [editingBus, setEditingBus] = useState(null)

  const [form, setForm] = useState({
    plate: '',
    code: '',
    transport_type: 'bus',
    route: '',
    operator_name: '',
    capacity: '',
    active: true,
  })

  useEffect(() => {
    loadBuses()
  }, [])

  async function loadBuses() {
    setLoading(true)
    setError('')

    try {
      const { data, error: busesError } = await supabase
        .from('buses')
        .select(`
          id,
          code,
          plate,
          capacity,
          active,
          transport_type,
          route,
          operator_name,
          driver_vehicle_assignments (
            id,
            driver_id,
            assigned_at,
            ended_at,
            active,
            drivers (
              id,
              profile_id,
              profiles (
                full_name,
                phone
              )
            )
          )
        `)
        .order('plate', { ascending: true })

      if (busesError) throw busesError

      setBuses(data || [])
    } catch (err) {
      console.error('Error cargando vehículos:', err)
      setError(
        err.message ||
          'No se pudieron cargar los vehículos.'
      )
    } finally {
      setLoading(false)
    }
  }

  function getTransportLabel(type) {
    const labels = {
      sit: 'SIT',
      combi: 'Combi',
      bus: 'Bus',
      taxi: 'Taxi',
      other: 'Otro',
    }

    return labels[type] || type || '—'
  }

  function getCurrentAssignment(bus) {
    const assignments = Array.isArray(
      bus.driver_vehicle_assignments
    )
      ? bus.driver_vehicle_assignments
      : []

    return (
      assignments.find(
        (assignment) =>
          assignment.active === true &&
          assignment.ended_at === null &&
          assignment.drivers?.profiles?.active !== false
      ) || null
    )
  }

  function getDriverName(bus) {
    const assignment = getCurrentAssignment(bus)

    return (
      assignment?.drivers?.profiles?.full_name ||
      'Sin conductor asignado'
    )
  }

  const filteredBuses = useMemo(() => {
    const query = search.trim().toLowerCase()

    return buses.filter((bus) => {
      const plate = String(
        bus.plate || ''
      ).toLowerCase()

      const code = String(
        bus.code || ''
      ).toLowerCase()

      const route = String(
        bus.route || ''
      ).toLowerCase()

      const operator = String(
        bus.operator_name || ''
      ).toLowerCase()

      const transport = getTransportLabel(
        bus.transport_type
      ).toLowerCase()

      const matchesSearch =
        !query ||
        plate.includes(query) ||
        code.includes(query) ||
        route.includes(query) ||
        operator.includes(query) ||
        transport.includes(query)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' &&
          bus.active === true) ||
        (statusFilter === 'inactive' &&
          bus.active === false)

      return matchesSearch && matchesStatus
    })
  }, [buses, search, statusFilter])

  function resetForm() {
    setForm({
      plate: '',
      code: '',
      transport_type: 'bus',
      route: '',
      operator_name: '',
      capacity: '',
      active: true,
    })

    setEditingBus(null)
  }

  function openAddModal() {
    resetForm()
    setError('')
    setSuccess('')
    setShowModal(true)
  }

  function openEditModal(bus) {
    setEditingBus(bus)

    setForm({
      plate: bus.plate || '',
      code: bus.code || '',
      transport_type:
        bus.transport_type || 'bus',
      route: bus.route || '',
      operator_name:
        bus.operator_name || '',
      capacity:
        bus.capacity !== null &&
        bus.capacity !== undefined
          ? String(bus.capacity)
          : '',
      active: bus.active !== false,
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
    const {
      name,
      value,
      type,
      checked,
    } = event.target

    setForm((previous) => ({
      ...previous,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }))
  }

  async function saveBus(event) {
    event.preventDefault()

    setError('')
    setSuccess('')

    const plate = form.plate
      .trim()
      .toUpperCase()

    const code = form.code
      .trim()
      .toUpperCase()

    const route = form.route.trim()

    const operatorName =
      form.operator_name.trim()

    const capacityValue =
      form.capacity.trim()

    if (!plate) {
      setError(
        'Ingresa la placa del vehículo.'
      )
      return
    }

    if (!form.transport_type) {
      setError(
        'Selecciona el tipo de transporte.'
      )
      return
    }

    let capacity = null

    if (capacityValue) {
      const parsedCapacity =
        Number(capacityValue)

      if (
        !Number.isInteger(parsedCapacity) ||
        parsedCapacity <= 0
      ) {
        setError(
          'La capacidad debe ser un número entero mayor que 0.'
        )
        return
      }

      capacity = parsedCapacity
    }

    setSaving(true)

    try {
      /*
       * Verificamos que la placa no esté utilizada
       * por otro vehículo.
       */
      const {
        data: existingBus,
        error: plateError,
      } = await supabase
        .from('buses')
        .select('id, plate')
        .eq('plate', plate)
        .maybeSingle()

      if (plateError) {
        throw plateError
      }

      if (
        existingBus &&
        existingBus.id !== editingBus?.id
      ) {
        throw new Error(
          `La placa ${plate} ya está registrada en SafeBus.`
        )
      }

      const busData = {
        plate,
        code: code || null,
        transport_type:
          form.transport_type,
        route: route || null,
        operator_name:
          operatorName || null,
        capacity,
        active: form.active,
      }

      if (editingBus) {
        /*
         * Si se desactiva un vehículo que tiene
         * un conductor asignado, cerramos la
         * asignación activa.
         */
        if (
          editingBus.active === true &&
          form.active === false
        ) {
          const assignment =
            getCurrentAssignment(editingBus)

          if (assignment) {
            const confirmed =
              window.confirm(
                `El vehículo ${plate} tiene asignado a ${getDriverName(
                  editingBus
                )}. Al desactivarlo se liberará la asignación actual. ¿Deseas continuar?`
              )

            if (!confirmed) {
              setSaving(false)
              return
            }

            const {
              error: assignmentError,
            } = await supabase
              .from(
                'driver_vehicle_assignments'
              )
              .update({
                active: false,
                ended_at:
                  new Date().toISOString(),
              })
              .eq(
                'id',
                assignment.id
              )

            if (assignmentError) {
              throw assignmentError
            }
          }
        }

        const {
          error: updateError,
        } = await supabase
          .from('buses')
          .update(busData)
          .eq('id', editingBus.id)

        if (updateError) {
          throw updateError
        }

        await loadBuses()

        setShowModal(false)
        resetForm()

        setSuccess(
          'Vehículo actualizado correctamente.'
        )
      } else {
        const {
          error: insertError,
        } = await supabase
          .from('buses')
          .insert(busData)

        if (insertError) {
          throw insertError
        }

        await loadBuses()

        setShowModal(false)
        resetForm()

        setSuccess(
          'Vehículo registrado correctamente.'
        )
      }
    } catch (err) {
      console.error(
        'Error guardando vehículo:',
        err
      )

      setError(
        err.message ||
          'No se pudo guardar el vehículo.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleBusStatus(bus) {
    const nextActive = !bus.active

    const assignment =
      getCurrentAssignment(bus)

    if (
      !nextActive &&
      assignment
    ) {
      const confirmed =
        window.confirm(
          `El vehículo ${bus.plate} está asignado actualmente a ${getDriverName(
            bus
          )}. Al desactivarlo se liberará la asignación. ¿Deseas continuar?`
        )

      if (!confirmed) return
    } else {
      const confirmed =
        window.confirm(
          nextActive
            ? `¿Quieres activar el vehículo ${bus.plate}?`
            : `¿Quieres desactivar el vehículo ${bus.plate}?`
        )

      if (!confirmed) return
    }

    setError('')
    setSuccess('')

    try {
      const {
        error: busError,
      } = await supabase
        .from('buses')
        .update({
          active: nextActive,
        })
        .eq('id', bus.id)

      if (busError) {
        throw busError
      }

      if (
        !nextActive &&
        assignment
      ) {
        const {
          error: assignmentError,
        } = await supabase
          .from(
            'driver_vehicle_assignments'
          )
          .update({
            active: false,
            ended_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            assignment.id
          )

        if (assignmentError) {
          throw assignmentError
        }
      }

      await loadBuses()

      setSuccess(
        nextActive
          ? `Vehículo ${bus.plate} activado.`
          : `Vehículo ${bus.plate} desactivado y asignación liberada.`
      )
    } catch (err) {
      console.error(
        'Error cambiando estado del vehículo:',
        err
      )

      setError(
        err.message ||
          'No se pudo cambiar el estado del vehículo.'
      )
    }
  }

  function goBack() {
    navigate('/admin')
  }

  const totalBuses = buses.length

  const activeBuses =
    buses.filter(
      (bus) => bus.active === true
    ).length

  const inactiveBuses =
    buses.filter(
      (bus) => bus.active === false
    ).length

  const assignedBuses =
    buses.filter(
      (bus) =>
        getCurrentAssignment(bus)
    ).length

  if (loading) {
    return (
      <main className="buses-page">
        <div className="buses-loading">
          <div className="buses-loading-icon">
            🚌
          </div>

          <h2>
            Cargando vehículos...
          </h2>

          <p>
            Consultando vehículos registrados.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="buses-page">
      <header className="buses-header">
        <div className="buses-header-left">
          <button
            type="button"
            className="buses-back-button"
            onClick={goBack}
          >
            ←
          </button>

          <div>
            <span className="buses-eyebrow">
              SAFE BUS
            </span>

            <h1>Buses</h1>

            <p>
              Registro y gestión de vehículos
            </p>
          </div>
        </div>

        <button
          type="button"
          className="buses-add-button"
          onClick={openAddModal}
        >
          + Registrar vehículo
        </button>
      </header>

      <section className="buses-content">
        {error && (
          <div className="buses-message buses-message-error">
            <span>⚠️</span>

            <p>{error}</p>

            <button
              type="button"
              onClick={() =>
                setError('')
              }
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="buses-message buses-message-success">
            <span>✓</span>

            <p>{success}</p>

            <button
              type="button"
              onClick={() =>
                setSuccess('')
              }
            >
              ×
            </button>
          </div>
        )}

        <section className="buses-summary">
          <div className="summary-card">
            <span>
              Vehículos
            </span>

            <strong>
              {totalBuses}
            </strong>
          </div>

          <div className="summary-card">
            <span>
              Activos
            </span>

            <strong>
              {activeBuses}
            </strong>
          </div>

          <div className="summary-card">
            <span>
              Inactivos
            </span>

            <strong>
              {inactiveBuses}
            </strong>
          </div>

          <div className="summary-card">
            <span>
              Conductor asignado
            </span>

            <strong>
              {assignedBuses}
            </strong>
          </div>
        </section>

        <section className="buses-panel">
          <div className="buses-panel-header">
            <div>
              <h2>
                Registro de vehículos
              </h2>

              <p>
                Estos vehículos estarán disponibles
                para su asignación a conductores.
              </p>
            </div>

            <button
              type="button"
              className="buses-refresh-button"
              onClick={loadBuses}
            >
              ↻ Actualizar
            </button>
          </div>

          <div className="buses-filters">
            <div className="buses-search">
              <span>⌕</span>

              <input
                type="search"
                placeholder="Buscar por placa, código, ruta u operador..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                Todos los estados
              </option>

              <option value="active">
                Activos
              </option>

              <option value="inactive">
                Inactivos
              </option>
            </select>
          </div>

          {filteredBuses.length === 0 ? (
            <div className="buses-empty">
              <div>🚌</div>

              <h3>
                {buses.length === 0
                  ? 'Aún no hay vehículos registrados'
                  : 'No se encontraron vehículos'}
              </h3>

              <p>
                {buses.length === 0
                  ? 'Registra el primer vehículo para comenzar a asignarlo a conductores.'
                  : 'Prueba con otra placa, ruta, código u operador.'}
              </p>

              {buses.length === 0 && (
                <button
                  type="button"
                  className="buses-add-button"
                  onClick={
                    openAddModal
                  }
                >
                  + Registrar vehículo
                </button>
              )}
            </div>
          ) : (
            <div className="buses-table-wrapper">
              <table className="buses-table">
                <thead>
                  <tr>
                    <th>
                      Placa
                    </th>

                    <th>
                      Tipo
                    </th>

                    <th>
                      Ruta
                    </th>

                    <th>
                      Operador
                    </th>

                    <th>
                      Capacidad
                    </th>

                    <th>
                      Conductor
                    </th>

                    <th>
                      Estado
                    </th>

                    <th>
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBuses.map(
                    (bus) => {
                      const assignment =
                        getCurrentAssignment(
                          bus
                        )

                      return (
                        <tr
                          key={bus.id}
                        >
                          <td>
                            <div className="bus-identity">
                              <strong>
                                {bus.plate}
                              </strong>

                              <span>
                                {bus.code ||
                                  'Sin código'}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span className="transport-badge">
                              {getTransportLabel(
                                bus.transport_type
                              )}
                            </span>
                          </td>

                          <td>
                            {bus.route ? (
                              <span>
                                {bus.route}
                              </span>
                            ) : (
                              <span className="muted">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            {bus.operator_name ? (
                              <span>
                                {
                                  bus.operator_name
                                }
                              </span>
                            ) : (
                              <span className="muted">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            {bus.capacity ? (
                              <span>
                                {
                                  bus.capacity
                                }{' '}
                                pasajeros
                              </span>
                            ) : (
                              <span className="muted">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            {assignment ? (
                              <div className="assigned-driver">
                                <strong>
                                  {
                                    assignment
                                      .drivers
                                      ?.profiles
                                      ?.full_name
                                  }
                                </strong>

                                <span>
                                  Conductor actual
                                </span>
                              </div>
                            ) : (
                              <span className="no-driver">
                                Sin conductor
                              </span>
                            )}
                          </td>

                          <td>
                            <span
                              className={`status-pill ${
                                bus.active
                                  ? 'status-active'
                                  : 'status-inactive'
                              }`}
                            >
                              {bus.active
                                ? 'Activo'
                                : 'Inactivo'}
                            </span>
                          </td>

                          <td>
                            <div className="bus-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    bus
                                  )
                                }
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                className={
                                  bus.active
                                    ? 'danger-action'
                                    : 'activate-action'
                                }
                                onClick={() =>
                                  toggleBusStatus(
                                    bus
                                  )
                                }
                              >
                                {bus.active
                                  ? 'Desactivar'
                                  : 'Activar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="buses-note">
          <span>🔗</span>

          <p>
            Los vehículos registrados aquí estarán
            disponibles para ser asignados a los
            conductores y posteriormente podrán ser
            identificados mediante su placa durante
            una emergencia.
          </p>
        </div>
      </section>

      {showModal && (
        <div className="buses-modal-overlay">
          <div className="buses-modal">
            <div className="buses-modal-header">
              <div>
                <span className="buses-eyebrow">
                  SAFE BUS
                </span>

                <h2>
                  {editingBus
                    ? 'Editar vehículo'
                    : 'Registrar vehículo'}
                </h2>
              </div>

              <button
                type="button"
                className="buses-modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              className="buses-form"
              onSubmit={saveBus}
            >
              <div className="buses-form-row">
                <div className="buses-form-group">
                  <label htmlFor="plate">
                    Placa *
                  </label>

                  <input
                    id="plate"
                    name="plate"
                    type="text"
                    value={form.plate}
                    onChange={handleChange}
                    placeholder="Ej. A1B-234"
                    autoCapitalize="characters"
                    disabled={saving}
                  />
                </div>

                <div className="buses-form-group">
                  <label htmlFor="code">
                    Código
                  </label>

                  <input
                    id="code"
                    name="code"
                    type="text"
                    value={form.code}
                    onChange={handleChange}
                    placeholder="Ej. BUS-001"
                    autoCapitalize="characters"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="buses-form-group">
                <label htmlFor="transport_type">
                  Tipo de transporte *
                </label>

                <select
                  id="transport_type"
                  name="transport_type"
                  value={
                    form.transport_type
                  }
                  onChange={handleChange}
                  disabled={saving}
                >
                  <option value="bus">
                    Bus
                  </option>

                  <option value="combi">
                    Combi
                  </option>

                  <option value="sit">
                    SIT
                  </option>

                  <option value="taxi">
                    Taxi
                  </option>

                  <option value="other">
                    Otro
                  </option>
                </select>
              </div>

              <div className="buses-form-row">
                <div className="buses-form-group">
                  <label htmlFor="route">
                    Ruta
                  </label>

                  <input
                    id="route"
                    name="route"
                    type="text"
                    value={form.route}
                    onChange={handleChange}
                    placeholder="Ej. Ruta 5"
                    disabled={saving}
                  />
                </div>

                <div className="buses-form-group">
                  <label htmlFor="capacity">
                    Capacidad
                  </label>

                  <input
                    id="capacity"
                    name="capacity"
                    type="number"
                    min="1"
                    step="1"
                    value={
                      form.capacity
                    }
                    onChange={handleChange}
                    placeholder="Ej. 40"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="buses-form-group">
                <label htmlFor="operator_name">
                  Empresa / operador
                </label>

                <input
                  id="operator_name"
                  name="operator_name"
                  type="text"
                  value={
                    form.operator_name
                  }
                  onChange={handleChange}
                  placeholder="Ej. Empresa de Transporte X"
                  disabled={saving}
                />
              </div>

              <label className="buses-active-checkbox">
                <input
                  type="checkbox"
                  name="active"
                  checked={
                    form.active
                  }
                  onChange={handleChange}
                  disabled={saving}
                />

                <span>
                  Vehículo activo
                </span>
              </label>

              {error && (
                <div className="buses-form-error">
                  {error}
                </div>
              )}

              <div className="buses-form-actions">
                <button
                  type="button"
                  className="buses-cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="buses-save-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Guardando...'
                    : editingBus
                      ? 'Guardar cambios'
                      : 'Registrar vehículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default Buses
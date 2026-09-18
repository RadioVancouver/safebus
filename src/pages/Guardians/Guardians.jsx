import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'
import './Guardians.css'

function Guardians() {
  const [guardians, setGuardians] = useState([])
  const [students, setStudents] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showModal, setShowModal] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    student_id: '',
    relationship: 'Madre',
    is_primary: true,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const { data: guardiansData, error: guardiansError } =
        await supabase
          .from('guardians')
          .select(`
            id,
            profile_id,
            created_at,
            profiles (
              full_name,
              phone,
              role,
              active
            ),
            student_guardians (
              id,
              relationship,
              is_primary,
              students (
                id,
                full_name,
                student_code
              )
            )
          `)
          .order('created_at', { ascending: false })

      if (guardiansError) {
        throw guardiansError
      }

      const { data: studentsData, error: studentsError } =
        await supabase
          .from('students')
          .select(`
            id,
            full_name,
            student_code,
            grade,
            section,
            active
          `)
          .eq('active', true)
          .order('full_name')

      if (studentsError) {
        throw studentsError
      }

      setGuardians(guardiansData || [])
      setStudents(studentsData || [])
    } catch (err) {
      console.error(err)
      setError(
        err.message ||
          'No se pudieron cargar los familiares.'
      )
    } finally {
      setLoading(false)
    }
  }

  function openModal() {
    setError('')
    setSuccess('')

    setForm({
      full_name: '',
      phone: '',
      email: '',
      password: '',
      student_id: '',
      relationship: 'Madre',
      is_primary: true,
    })

    setShowModal(true)
  }

  function closeModal() {
    if (saving) return

    setShowModal(false)
    setError('')
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function createGuardian(event) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (!form.full_name.trim()) {
      setError('Ingresa el nombre completo del familiar.')
      return
    }

    if (!form.email.trim()) {
      setError('Ingresa el correo electrónico.')
      return
    }

    if (!form.password) {
      setError('Ingresa una contraseña temporal.')
      return
    }

    if (form.password.length < 8) {
      setError(
        'La contraseña debe tener al menos 8 caracteres.'
      )
      return
    }

    if (!form.student_id) {
      setError('Selecciona el estudiante que será vinculado.')
      return
    }

    setSaving(true)

    try {
      const {
        data,
        error: functionError,
      } = await supabase.functions.invoke(
        'create-guardian-account',
        {
          body: {
            full_name: form.full_name,
            phone: form.phone,
            email: form.email,
            password: form.password,
            student_id: form.student_id,
            relationship: form.relationship,
            is_primary: form.is_primary,
          },
        }
      )

      if (functionError) {
        console.error(functionError)
        throw new Error(
          functionError.message ||
            'No se pudo crear la cuenta.'
        )
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            'No se pudo crear la cuenta del familiar.'
        )
      }

      setSuccess(
        `Cuenta creada correctamente para ${form.full_name}.`
      )

      setShowModal(false)

      await loadData()
    } catch (err) {
      console.error(err)

      setError(
        err.message ||
          'Ocurrió un error al crear el familiar.'
      )
    } finally {
      setSaving(false)
    }
  }

  function getStudentNames(guardian) {
    const relationships =
      guardian.student_guardians || []

    if (relationships.length === 0) {
      return 'Sin estudiante vinculado'
    }

    return relationships
      .map(
        (item) =>
          item.students?.full_name ||
          'Estudiante'
      )
      .join(', ')
  }

  function getRelationship(guardian) {
    const relationship =
      guardian.student_guardians?.[0]?.relationship

    return relationship || 'Familiar'
  }

  if (loading) {
    return (
      <main className="guardians-page">
        <div className="guardians-loading">
          Cargando familiares...
        </div>
      </main>
    )
  }

  return (
    <main className="guardians-page">
      <div className="guardians-header">
        <div>
          <span className="guardians-kicker">
            SAFEBUS
          </span>

          <h1>Familiares</h1>

          <p>
            Administra las cuentas familiares y
            sus estudiantes vinculados.
          </p>
        </div>

        <button
          className="guardian-new-button"
          onClick={openModal}
        >
          + Nuevo familiar
        </button>
      </div>

      {success && (
        <div className="guardian-success">
          {success}
        </div>
      )}

      {error && !showModal && (
        <div className="guardian-error">
          {error}
        </div>
      )}

      <section className="guardians-card">
        <div className="guardians-card-header">
          <div>
            <h2>Familiares registrados</h2>
            <span>
              {guardians.length}{' '}
              {guardians.length === 1
                ? 'familiar'
                : 'familiares'}
            </span>
          </div>
        </div>

        {guardians.length === 0 ? (
          <div className="guardians-empty">
            <div className="empty-icon">👨‍👩‍👧</div>

            <h3>No hay familiares registrados</h3>

            <p>
              Crea la primera cuenta familiar
              para vincularla con un estudiante.
            </p>

            <button
              className="guardian-new-button"
              onClick={openModal}
            >
              Crear familiar
            </button>
          </div>
        ) : (
          <div className="guardians-table-wrapper">
            <table className="guardians-table">
              <thead>
                <tr>
                  <th>Familiar</th>
                  <th>Contacto</th>
                  <th>Estudiante</th>
                  <th>Relación</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {guardians.map((guardian) => {
                  const profile =
                    guardian.profiles

                  return (
                    <tr key={guardian.id}>
                      <td>
                        <div className="guardian-name">
                          {profile?.full_name ||
                            'Sin nombre'}
                        </div>
                      </td>

                      <td>
                        <div className="guardian-contact">
                          <span>
                            {profile?.phone ||
                              'Sin teléfono'}
                          </span>

                          <small>
                            ID: {guardian.profile_id}
                          </small>
                        </div>
                      </td>

                      <td>
                        <div className="guardian-student">
                          {getStudentNames(guardian)}
                        </div>
                      </td>

                      <td>
                        {getRelationship(guardian)}
                      </td>

                      <td>
                        <span
                          className={
                            profile?.active
                              ? 'status-active'
                              : 'status-inactive'
                          }
                        >
                          {profile?.active
                            ? 'Activa'
                            : 'Inactiva'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <div className="guardian-modal-overlay">
          <div className="guardian-modal">
            <div className="guardian-modal-header">
              <div>
                <span className="guardians-kicker">
                  SAFEBUS
                </span>

                <h2>Nuevo familiar</h2>
              </div>

              <button
                className="guardian-close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              className="guardian-form"
              onSubmit={createGuardian}
            >
              <div className="guardian-form-group">
                <label>
                  Nombre completo
                </label>

                <input
                  type="text"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  placeholder="Ej. María Mendoza"
                  disabled={saving}
                />
              </div>

              <div className="guardian-form-row">
                <div className="guardian-form-group">
                  <label>Teléfono</label>

                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="987654321"
                    disabled={saving}
                  />
                </div>

                <div className="guardian-form-group">
                  <label>Relación</label>

                  <select
                    name="relationship"
                    value={form.relationship}
                    onChange={handleChange}
                    disabled={saving}
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

                    <option value="Hermano">
                      Hermano/a
                    </option>

                    <option value="Tutor">
                      Tutor/a
                    </option>

                    <option value="Familiar">
                      Familiar
                    </option>
                  </select>
                </div>
              </div>

              <div className="guardian-form-group">
                <label>
                  Correo electrónico
                </label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="familiar@safebus.pe"
                  disabled={saving}
                />
              </div>

              <div className="guardian-form-group">
                <label>
                  Contraseña temporal
                </label>

                <input
                  type="text"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  disabled={saving}
                />

                <small>
                  Entrega esta contraseña al
                  familiar para su primer acceso.
                </small>
              </div>

              <div className="guardian-form-group">
                <label>
                  Estudiante vinculado
                </label>

                <select
                  name="student_id"
                  value={form.student_id}
                  onChange={handleChange}
                  disabled={saving}
                >
                  <option value="">
                    Selecciona un estudiante
                  </option>

                  {students.map((student) => (
                    <option
                      key={student.id}
                      value={student.id}
                    >
                      {student.full_name} —{' '}
                      {student.student_code}
                    </option>
                  ))}
                </select>
              </div>

              <label className="guardian-checkbox">
                <input
                  type="checkbox"
                  name="is_primary"
                  checked={form.is_primary}
                  onChange={handleChange}
                  disabled={saving}
                />

                <span>
                  Familiar principal
                </span>
              </label>

              {error && (
                <div className="guardian-error">
                  {error}
                </div>
              )}

              <div className="guardian-form-actions">
                <button
                  type="button"
                  className="guardian-cancel"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="guardian-submit"
                  disabled={saving}
                >
                  {saving
                    ? 'Creando...'
                    : 'Crear familiar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default Guardians
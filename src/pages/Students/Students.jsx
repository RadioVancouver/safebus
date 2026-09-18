import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

import './Students.css'

function Students() {
  const navigate = useNavigate()

  const [students, setStudents] = useState([])
  const [schools, setSchools] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    school_id: '',
    student_code: '',
    grade: '',
    section: '',
    seat_number: '',
    active: true,
  })

  const [saving, setSaving] = useState(false)

  const [showAccountModal, setShowAccountModal] =
    useState(false)

  const [accountStudent, setAccountStudent] =
    useState(null)

  const [accountForm, setAccountForm] = useState({
    email: '',
    password: '',
  })

  const [creatingAccount, setCreatingAccount] =
    useState(false)

  const [accountError, setAccountError] =
    useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    const [
      { data: schoolsData, error: schoolsError },
      { data: studentsData, error: studentsError },
    ] = await Promise.all([
      supabase
        .from('schools')
        .select('id, name, code, district, city, active')
        .order('name'),

      supabase
        .from('students')
        .select(`
          id,
          profile_id,
          full_name,
          phone,
          student_code,
          grade,
          section,
          seat_number,
          active,
          school_id,
          schools (
            id,
            name
          ),
          profiles (
            id,
            full_name,
            phone,
            active
          )
        `)
        .order('full_name'),
    ])

    if (schoolsError) {
      console.error(
        'Error cargando instituciones:',
        schoolsError
      )

      setError(
        'No se pudieron cargar las instituciones educativas.'
      )
    }

    if (studentsError) {
      console.error(
        'Error cargando estudiantes:',
        studentsError
      )

      setError(
        'No se pudieron cargar los estudiantes.'
      )
    }

    setSchools(schoolsData || [])
    setStudents(studentsData || [])

    setLoading(false)
  }

  function openNewStudentModal() {
    setEditingStudent(null)

    setForm({
      full_name: '',
      phone: '',
      school_id: schools[0]?.id || '',
      student_code: '',
      grade: '',
      section: '',
      seat_number: '',
      active: true,
    })

    setError('')
    setShowModal(true)
  }

  function openEditModal(student) {
    setEditingStudent(student)

    setForm({
      full_name: student.full_name || '',
      phone: student.phone || '',
      school_id: student.school_id || '',
      student_code: student.student_code || '',
      grade: student.grade || '',
      section: student.section || '',
      seat_number:
        student.seat_number !== null &&
        student.seat_number !== undefined
          ? String(student.seat_number)
          : '',
      active: student.active !== false,
    })

    setError('')
    setShowModal(true)
  }

  function closeModal() {
    if (saving) return

    setShowModal(false)
    setEditingStudent(null)
  }

  function handleChange(event) {
    const { name, value, type, checked } =
      event.target

    setForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }))
  }

  async function handleSaveStudent(event) {
    event.preventDefault()

    setSaving(true)
    setError('')
    setSuccess('')

    if (!form.full_name.trim()) {
      setError(
        'Ingresa el nombre completo del estudiante.'
      )
      setSaving(false)
      return
    }

    if (!form.student_code.trim()) {
      setError(
        'Ingresa el código del estudiante.'
      )
      setSaving(false)
      return
    }

    if (!form.school_id) {
      setError(
        'Selecciona la institución educativa.'
      )
      setSaving(false)
      return
    }

    const studentData = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      school_id: form.school_id,
      student_code:
        form.student_code.trim().toUpperCase(),
      grade: form.grade.trim() || null,
      section:
        form.section.trim().toUpperCase() || null,
      seat_number:
        form.seat_number.trim()
          ? Number(form.seat_number)
          : null,
      active: form.active,
    }

    let result

    if (editingStudent) {
      result = await supabase
        .from('students')
        .update(studentData)
        .eq('id', editingStudent.id)
    } else {
      result = await supabase
        .from('students')
        .insert(studentData)
    }

    if (result.error) {
      console.error(
        'Error guardando estudiante:',
        result.error
      )

      if (
        result.error.code === '23505'
      ) {
        setError(
          'El código del estudiante ya existe.'
        )
      } else {
        setError(
          result.error.message ||
            'No se pudo guardar el estudiante.'
        )
      }

      setSaving(false)
      return
    }

    setShowModal(false)
    setEditingStudent(null)

    setSuccess(
      editingStudent
        ? 'Estudiante actualizado correctamente.'
        : 'Estudiante registrado correctamente.'
    )

    setSaving(false)

    await loadData()
  }

  async function toggleStudentActive(student) {
    const action = student.active
      ? 'desactivar'
      : 'activar'

    const confirmed = window.confirm(
      `¿Deseas ${action} a ${student.full_name}?`
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    const { error: updateError } =
      await supabase
        .from('students')
        .update({
          active: !student.active,
        })
        .eq('id', student.id)

    if (updateError) {
      console.error(
        'Error cambiando estado:',
        updateError
      )

      setError(
        'No se pudo cambiar el estado del estudiante.'
      )

      return
    }

    setSuccess(
      student.active
        ? `${student.full_name} fue desactivado.`
        : `${student.full_name} fue activado.`
    )

    await loadData()
  }

  function openAccountModal(student) {
    setAccountStudent(student)

    setAccountForm({
      email: '',
      password: '',
    })

    setAccountError('')
    setShowAccountModal(true)
  }

  function closeAccountModal() {
    if (creatingAccount) return

    setShowAccountModal(false)
    setAccountStudent(null)
    setAccountError('')
  }

  function handleAccountChange(event) {
    const { name, value } = event.target

    setAccountForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleCreateAccount(event) {
    event.preventDefault()

    if (!accountStudent) return

    setCreatingAccount(true)
    setAccountError('')
    setSuccess('')

    const email =
      accountForm.email.trim().toLowerCase()

    const password =
      accountForm.password

    if (!email) {
      setAccountError(
        'Ingresa el correo electrónico.'
      )

      setCreatingAccount(false)
      return
    }

    if (!password) {
      setAccountError(
        'Ingresa una contraseña temporal.'
      )

      setCreatingAccount(false)
      return
    }

    if (password.length < 8) {
      setAccountError(
        'La contraseña debe tener al menos 8 caracteres.'
      )

      setCreatingAccount(false)
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      console.log(
        'SAFE BUS FRONTEND USER:',
        user
      )

      const {
        data,
        error: functionError,
      } = await supabase.functions.invoke(
        'create-student-account',
        {
          body: {
            student_id:
              accountStudent.id,
            email,
            password,
          },
        }
      )

      if (functionError) {
        console.error(
          'Error Edge Function:',
          functionError
        )

        let message =
          'No se pudo crear la cuenta del estudiante.'

        try {
          if (functionError.context) {
            const response =
              functionError.context

            const responseData =
              await response.json()

            if (responseData?.error) {
              message =
                responseData.error
            }
          }
        } catch (parseError) {
          console.error(
            'Error leyendo respuesta:',
            parseError
          )
        }

        setAccountError(message)
        setCreatingAccount(false)
        return
      }

      if (data?.success) {
        setShowAccountModal(false)

        setSuccess(
          `Cuenta de acceso creada correctamente para ${accountStudent.full_name}.`
        )

        setAccountStudent(null)

        setAccountForm({
          email: '',
          password: '',
        })

        await loadData()
      } else {
        setAccountError(
          data?.error ||
            'No se pudo crear la cuenta.'
        )
      }
    } catch (error) {
      console.error(
        'Error creando cuenta:',
        error
      )

      setAccountError(
        error?.message ||
          'Ocurrió un error al crear la cuenta.'
      )
    }

    setCreatingAccount(false)
  }

  const normalizedSearch =
    search.trim().toLowerCase()

  const filteredStudents =
    students.filter((student) => {
      if (!normalizedSearch) {
        return true
      }

      const values = [
        student.full_name,
        student.student_code,
        student.phone,
        student.grade,
        student.section,
        student.schools?.name,
      ]

      return values.some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(normalizedSearch)
      )
    })

  if (loading) {
    return (
      <main className="students-loading-page">
        <div className="students-loading-card">
          <div className="students-loading-icon">
            🎓
          </div>

          <p>
            Cargando estudiantes...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="students-page">

      <header className="students-header">

        <div>
          <button
            className="students-back"
            type="button"
            onClick={() =>
              navigate('/admin')
            }
          >
            ← Volver al panel
          </button>

          <h1>
            Estudiantes
          </h1>

          <p>
            Administración de estudiantes
            registrados en el sistema.
          </p>
        </div>

        <button
          className="students-new-button"
          type="button"
          onClick={openNewStudentModal}
        >
          + Nuevo estudiante
        </button>

      </header>


      {success && (
        <div className="students-success">
          {success}
        </div>
      )}


      {error && (
        <div className="students-error">
          {error}
        </div>
      )}


      <section className="students-toolbar">

        <div className="students-search">

          <span>⌕</span>

          <input
            type="text"
            placeholder="Buscar por nombre, código, institución, grado o sección..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

        </div>

        <span className="students-count">
          {filteredStudents.length}{' '}
          estudiante
          {filteredStudents.length !== 1
            ? 's'
            : ''}
        </span>

      </section>


      <section className="students-table-card">

        <div className="students-table-wrapper">

          <table className="students-table">

            <thead>

              <tr>
                <th>ESTUDIANTE</th>
                <th>CÓDIGO</th>
                <th>INSTITUCIÓN</th>
                <th>GRADO</th>
                <th>SECCIÓN</th>
                <th>ASIENTO</th>
                <th>CUENTA</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>

            </thead>

            <tbody>

              {filteredStudents.length === 0 ? (

                <tr>

                  <td
                    colSpan="9"
                    className="students-empty"
                  >
                    No se encontraron estudiantes.
                  </td>

                </tr>

              ) : (

                filteredStudents.map(
                  (student) => (

                    <tr key={student.id}>

                      <td>

                        <div className="student-name-cell">

                          <strong>
                            {student.full_name}
                          </strong>

                          {student.phone && (
                            <span>
                              {student.phone}
                            </span>
                          )}

                        </div>

                      </td>


                      <td>
                        {student.student_code}
                      </td>


                      <td>
                        {student.schools?.name ||
                          '—'}
                      </td>


                      <td>
                        {student.grade || '—'}
                      </td>


                      <td>
                        {student.section || '—'}
                      </td>


                      <td>
                        {student.seat_number ??
                          '—'}
                      </td>


                      <td>

                        {student.profile_id ? (

                          <span className="status-badge status-active">
                            Activa
                          </span>

                        ) : student.active ? (

                          <button
                            type="button"
                            className="table-action action-account"
                            onClick={() =>
                              openAccountModal(
                                student
                              )
                            }
                          >
                            Crear acceso
                          </button>

                        ) : (

                          <span className="status-badge status-inactive">
                            Sin acceso
                          </span>

                        )}

                      </td>


                      <td>

                        <span
                          className={`status-badge ${
                            student.active
                              ? 'status-active'
                              : 'status-inactive'
                          }`}
                        >
                          {student.active
                            ? 'Activo'
                            : 'Inactivo'}
                        </span>

                      </td>


                      <td>

                        <div className="students-actions">

                          <button
                            type="button"
                            className="table-action action-edit"
                            onClick={() =>
                              openEditModal(
                                student
                              )
                            }
                          >
                            Editar
                          </button>


                          <button
                            type="button"
                            className="table-action action-disable"
                            onClick={() =>
                              toggleStudentActive(
                                student
                              )
                            }
                          >
                            {student.active
                              ? 'Desactivar'
                              : 'Activar'}
                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          MODAL NUEVO / EDITAR ESTUDIANTE
          ===================================================== */}

      {showModal && (

        <div
          className="students-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal()
            }
          }}
        >

          <div className="students-modal">

            <div className="students-modal-header">

              <div>

                <h2>
                  {editingStudent
                    ? 'Editar estudiante'
                    : 'Nuevo estudiante'}
                </h2>

                <p>
                  {editingStudent
                    ? 'Actualiza los datos del estudiante.'
                    : 'Registra un nuevo estudiante en SafeBus.'}
                </p>

              </div>

              <button
                type="button"
                className="students-modal-close"
                onClick={closeModal}
              >
                ×
              </button>

            </div>


            <form
              className="students-form"
              onSubmit={handleSaveStudent}
            >

              <div className="students-form-grid">

                <div className="students-field students-field-full">

                  <label>
                    Nombre completo
                  </label>

                  <input
                    name="full_name"
                    type="text"
                    value={form.full_name}
                    onChange={handleChange}
                    placeholder="Ej. Carlos Mendoza"
                    required
                  />

                </div>


                <div className="students-field">

                  <label>
                    Teléfono
                  </label>

                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="Ej. 987654321"
                  />

                </div>


                <div className="students-field">

                  <label>
                    Institución educativa
                  </label>

                  <select
                    name="school_id"
                    value={form.school_id}
                    onChange={handleChange}
                    required
                  >

                    <option value="">
                      Seleccionar institución
                    </option>

                    {schools.map(
                      (school) => (
                        <option
                          key={school.id}
                          value={school.id}
                        >
                          {school.name}
                        </option>
                      )
                    )}

                  </select>

                </div>


                <div className="students-field">

                  <label>
                    Código del estudiante
                  </label>

                  <input
                    name="student_code"
                    type="text"
                    value={form.student_code}
                    onChange={handleChange}
                    placeholder="Ej. SB0003"
                    required
                  />

                </div>


                <div className="students-field">

                  <label>
                    Grado
                  </label>

                  <input
                    name="grade"
                    type="text"
                    value={form.grade}
                    onChange={handleChange}
                    placeholder="Ej. 5to Secundaria"
                  />

                </div>


                <div className="students-field">

                  <label>
                    Sección
                  </label>

                  <input
                    name="section"
                    type="text"
                    value={form.section}
                    onChange={handleChange}
                    placeholder="Ej. A"
                  />

                </div>


                <div className="students-field">

                  <label>
                    Número de asiento
                  </label>

                  <input
                    name="seat_number"
                    type="number"
                    min="1"
                    value={form.seat_number}
                    onChange={handleChange}
                    placeholder="Opcional"
                  />

                </div>

              </div>


              <label className="students-checkbox">

                <input
                  name="active"
                  type="checkbox"
                  checked={form.active}
                  onChange={handleChange}
                />

                <span>
                  Estudiante activo
                </span>

              </label>


              <div className="students-modal-actions">

                <button
                  type="button"
                  className="students-cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="students-save-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Guardando...'
                    : editingStudent
                    ? 'Guardar cambios'
                    : 'Registrar estudiante'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}


      {/* =====================================================
          MODAL CREAR CUENTA
          ===================================================== */}

      {showAccountModal &&
        accountStudent && (

          <div
            className="students-modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeAccountModal()
              }
            }}
          >

            <div className="students-modal account-modal">

              <div className="students-modal-header">

                <div>

                  <h2>
                    Crear cuenta
                  </h2>

                  <p>
                    Crear acceso para el estudiante.
                  </p>

                </div>

                <button
                  type="button"
                  className="students-modal-close"
                  onClick={closeAccountModal}
                >
                  ×
                </button>

              </div>


              <div className="account-student-summary">

                <div className="account-student-icon">
                  🎓
                </div>

                <div>

                  <strong>
                    {accountStudent.full_name}
                  </strong>

                  <span>
                    Código:{' '}
                    {accountStudent.student_code}
                  </span>

                </div>

              </div>


              <form
                className="students-form"
                onSubmit={handleCreateAccount}
              >

                <div className="students-field">

                  <label>
                    Correo electrónico
                  </label>

                  <input
                    name="email"
                    type="email"
                    value={accountForm.email}
                    onChange={handleAccountChange}
                    placeholder="estudiante@ejemplo.com"
                    autoComplete="off"
                    required
                  />

                  <small>
                    Este correo será utilizado para iniciar sesión en SafeBus.
                  </small>

                </div>


                <div className="students-field">

                  <label>
                    Contraseña temporal
                  </label>

                  <input
                    name="password"
                    type="password"
                    value={accountForm.password}
                    onChange={handleAccountChange}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    minLength="8"
                    required
                  />

                  <small>
                    Entrega esta contraseña al estudiante de manera segura.
                  </small>

                </div>


                <div className="account-security-note">

                  <span>
                    🔒
                  </span>

                  <p>
                    La cuenta se creará como
                    estudiante y quedará asociada
                    automáticamente a este registro.
                  </p>

                </div>


                {accountError && (
                  <div className="students-error">
                    {accountError}
                  </div>
                )}


                <div className="students-modal-actions">

                  <button
                    type="button"
                    className="students-cancel-button"
                    onClick={closeAccountModal}
                    disabled={creatingAccount}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="students-save-button"
                    disabled={creatingAccount}
                  >
                    {creatingAccount
                      ? 'Creando cuenta...'
                      : 'Crear cuenta'}
                  </button>

                </div>

              </form>

            </div>

          </div>

        )}

    </main>
  )
}

export default Students
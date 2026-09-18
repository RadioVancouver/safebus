import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../services/supabase'

function ProtectedRoute({ children, allowedRole }) {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single()

    if (
      profile &&
      profile.active &&
      profile.role === allowedRole
    ) {
      setAuthorized(true)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="page-loading">
        Cargando SafeBus...
      </div>
    )
  }

  if (!authorized) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
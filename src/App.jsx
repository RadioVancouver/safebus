import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Intro from './pages/Intro/Intro'
import Login from './pages/Login/Login'
import Admin from './pages/Admin/Admin'
import Students from './pages/Students/Students'
import Guardians from './pages/Guardians/Guardians'
import Student from './pages/Student/Student'
import ProtectedRoute from './routes/ProtectedRoute'

import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/"
          element={<Intro />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <Admin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/estudiantes"
          element={
            <ProtectedRoute allowedRole="admin">
              <Students />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/familiares"
          element={
            <ProtectedRoute allowedRole="admin">
              <Guardians />
            </ProtectedRoute>
          }
        />

        <Route
          path="/estudiante"
          element={
            <ProtectedRoute allowedRole="student">
              <Student />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  )
}

export default App
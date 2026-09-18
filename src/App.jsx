import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Intro from './pages/Intro/Intro'
import Login from './pages/Login/Login'
import Admin from './pages/Admin/Admin'
import Students from './pages/Students/Students'
import Drivers from './pages/Drivers/Drivers'
import Buses from './pages/buses/Buses'
import Guardians from './pages/Guardians/Guardians'
import Student from './pages/Student/Student'
import AlertShare from './pages/AlertShare/AlertShare'
import ProtectedRoute from './routes/ProtectedRoute'

import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PÁGINA INICIAL */}
        <Route path="/" element={<Intro />} />

        {/* LOGIN */}
        <Route path="/login" element={<Login />} />

        {/* MAPA PÚBLICO DE ALERTA */}
        <Route path="/alerta/:token" element={<AlertShare />} />

        {/* =========================
            PORTAL ADMINISTRADOR
           ========================= */}

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <Admin />
            </ProtectedRoute>
          }
        />

        {/* ESTUDIANTES */}
        <Route
          path="/admin/estudiantes"
          element={
            <ProtectedRoute allowedRole="admin">
              <Students />
            </ProtectedRoute>
          }
        />

        {/* CONDUCTORES */}
        <Route
          path="/admin/conductores"
          element={
            <ProtectedRoute allowedRole="admin">
              <Drivers />
            </ProtectedRoute>
          }
        />

        {/* BUSES / VEHÍCULOS */}
        <Route
          path="/admin/buses"
          element={
            <ProtectedRoute allowedRole="admin">
              <Buses />
            </ProtectedRoute>
          }
        />

        {/* FAMILIARES */}
        <Route
          path="/admin/familiares"
          element={
            <ProtectedRoute allowedRole="admin">
              <Guardians />
            </ProtectedRoute>
          }
        />

        {/* =========================
            PORTAL ESTUDIANTE
           ========================= */}

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
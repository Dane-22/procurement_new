import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import LandingPage from './components/LandingPage'
import Login from './components/Login'
import App from './App'

const AppRouter = () => {
  const { user } = useAuth()

  return (
    <Routes>
      <Route 
        path="/" 
        element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} 
      />
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      <Route 
        path="/dashboard/*" 
        element={user ? <App /> : <Navigate to="/login" replace />} 
      />
    </Routes>
  )
}

export default AppRouter
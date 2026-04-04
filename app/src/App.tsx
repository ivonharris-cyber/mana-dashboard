import { Routes, Route } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import CommandCenter from './pages/CommandCenter'
import AgentsPage from './pages/AgentsPage'
import AgentDetail from './pages/AgentDetail'
import RelayPage from './pages/RelayPage'
import WorkflowsPage from './pages/WorkflowsPage'
import ServicesPage from './pages/ServicesPage'
import SessionsPage from './pages/SessionsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<CommandCenter />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/:id" element={<AgentDetail />} />
        <Route path="/relay" element={<RelayPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
      </Route>
    </Routes>
  )
}

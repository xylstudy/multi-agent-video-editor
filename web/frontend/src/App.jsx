import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Assistant from './pages/Assistant.jsx'
import Dashboard from './pages/Dashboard.jsx'
import GeneDetail from './pages/GeneDetail.jsx'
import Genes from './pages/Genes.jsx'
import Insights from './pages/Insights.jsx'
import Knowledge from './pages/Knowledge.jsx'
import Login from './pages/Login.jsx'
import Projects from './pages/Projects.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import Register from './pages/Register.jsx'
import Settings from './pages/Settings.jsx'
import TaskDetail from './pages/TaskDetail.jsx'
import Works from './pages/Works.jsx'
import { useAuth } from './context/auth-context.js'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-center">加载中...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="tasks/:id" element={<TaskDetail />} />
        <Route path="genes" element={<Genes />} />
        <Route path="genes/:id" element={<GeneDetail />} />
        <Route path="knowledge" element={<Knowledge />} />
        <Route path="insights" element={<Insights />} />
        <Route path="works" element={<Works />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App

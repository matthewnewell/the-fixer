import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { PersonaProvider } from './lib/persona'
import Nav from './components/Nav'
import SplashPage from './pages/SplashPage'
import CasesPage from './pages/CasesPage'
import IncidentDetailPage from './pages/IncidentDetailPage'
import './App.css'

/** Shared chrome for every operational page — same pattern as the sibling apps: the splash
 * page renders its own Nav directly, everything else gets it via this layout. The AI chat
 * pane lives inside IncidentDetailPage itself, not here — it's scoped to one case and
 * meaningless anywhere else, unlike Value Stream/Conway's Depot's portfolio-wide assistant. */
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Nav />
      <div className="app-layout__body">{children}</div>
    </div>
  )
}

/** The old "Generate Report" page: the case's own Record replaced it. */
function RecordRedirect() {
  const { incidentId } = useParams<{ incidentId: string }>()
  return <Navigate to={`/incidents/${incidentId}?view=record`} replace />
}

export default function App() {
  return (
    <PersonaProvider>
      <Routes>
        <Route path="/about" element={<SplashPage />} />
        <Route path="/" element={<Layout><CasesPage /></Layout>} />
        <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
        <Route path="/incidents/:incidentId/plan" element={<RecordRedirect />} />
      </Routes>
    </PersonaProvider>
  )
}

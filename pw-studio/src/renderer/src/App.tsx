import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProjectsPage } from './pages/ProjectsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ExplorerPage } from './pages/ExplorerPage'
import { RunsPage } from './pages/RunsPage'
import { RunDetailPage } from './pages/RunDetailPage'
import { RunComparisonPage } from './pages/RunComparisonPage'
import { SettingsPage } from './pages/SettingsPage'
import { EnvironmentsPage } from './pages/EnvironmentsPage'
import { RecorderPage } from './pages/RecorderPage'
import { FlakyTestsPage } from './pages/FlakyTestsPage'
import { ProjectLayout } from './components/ProjectLayout'
import './App.css'

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/project/:id" element={<ProjectLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="explorer" element={<ExplorerPage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="runs/compare" element={<RunComparisonPage />} />
          <Route path="runs/:runId" element={<RunDetailPage />} />
          <Route path="environments" element={<EnvironmentsPage />} />
          <Route path="recorder" element={<RecorderPage />} />
          <Route path="flaky" element={<FlakyTestsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

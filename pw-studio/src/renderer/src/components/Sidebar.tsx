import { useNavigate, useLocation } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { RegisteredProject, HealthSnapshot } from '../../../shared/types/ipc'

type SidebarProps = {
  project: RegisteredProject
  health: HealthSnapshot | null
  hasActiveRun: boolean
}

type NavItem = {
  label: string
  icon: string
  path: string
}

export function Sidebar({ project, health, hasActiveRun }: SidebarProps): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const base = `/project/${project.id}`

  const navItems: NavItem[] = [
    { label: 'Dashboard', icon: '\u2302', path: base },
    { label: 'Explorer', icon: '\u{1F4C1}', path: `${base}/explorer` },
    { label: 'Runs', icon: '\u25B6', path: `${base}/runs` },
    { label: 'Recorder', icon: '\u23FA', path: `${base}/recorder` },
    { label: 'Environments', icon: '\u{1F310}', path: `${base}/environments` },
    { label: 'Flaky Tests', icon: '\u26A0', path: `${base}/flaky` },
  ]

  const isActive = (path: string): boolean => {
    if (path === base) {
      return location.pathname === base
    }
    return location.pathname.startsWith(path)
  }

  const healthDot = (): string => {
    if (!health) return 'health-dot-unknown'
    if (health.overallStatus === 'pass') return 'health-dot-pass'
    if (health.overallStatus === 'warning') return 'health-dot-warn'
    return 'health-dot-error'
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-project-name">{project.name}</div>
        <div className={`sidebar-health-dot ${healthDot()}`} title={
          health ? `Health: ${health.overallStatus}` : 'Loading health...'
        } />
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.path}
            className={`sidebar-nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
            {item.label === 'Runs' && hasActiveRun && (
              <span className="sidebar-run-indicator" />
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-nav-item"
          onClick={() => navigate(`${base}/settings`)}
        >
          <span className="sidebar-nav-icon">{'\u2699'}</span>
          <span className="sidebar-nav-label">Settings</span>
        </button>
        <button
          className="sidebar-back-link"
          onClick={() => navigate('/')}
        >
          {'\u2190'} Back to Projects
        </button>
      </div>
    </aside>
  )
}

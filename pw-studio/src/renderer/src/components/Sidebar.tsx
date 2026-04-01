import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'pw-studio.sidebar.collapsed'

/**
 * Renders the project navigation rail and persists whether it is collapsed for icon-only navigation.
 *
 * @param project The active project metadata used to build route targets and labels.
 * @param health The latest project health snapshot, when available.
 * @param hasActiveRun Whether the project currently has a running test execution.
 * @returns The sidebar navigation for project routes.
 */
export function Sidebar({ project, health, hasActiveRun }: SidebarProps): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  })
  const base = `/project/${project.id}`

  const navItems: NavItem[] = [
    { label: 'Dashboard', icon: '\u2302', path: base },
    { label: 'Explorer', icon: '\u{1F4C1}', path: `${base}/explorer` },
    { label: 'Suites', icon: '\u25A4', path: `${base}/suites` },
    { label: 'Runs', icon: '\u25B6', path: `${base}/runs` },
    { label: 'Recorder', icon: '\u23FA', path: `${base}/recorder` },
    { label: 'Environments', icon: '\u{1F310}', path: `${base}/environments` },
    { label: 'Flaky Tests', icon: '\u26A0', path: `${base}/flaky` },
    { label: 'Integrations', icon: '\u{1F9E9}', path: `${base}/integrations` },
  ]

  /**
   * Determines whether a navigation target should be marked active for the current route.
   *
   * @param path The route path to compare against the current location.
   * @returns `true` when the route should be highlighted as selected.
   */
  const isActive = (path: string): boolean => {
    if (path === base) {
      return location.pathname === base
    }
    return location.pathname.startsWith(path)
  }

  /**
   * Resolves the sidebar health status class from the latest project health snapshot.
   *
   * @returns The CSS modifier class for the health indicator.
   */
  const healthDot = (): string => {
    if (!health) return 'health-dot-unknown'
    if (health.overallStatus === 'pass') return 'health-dot-pass'
    if (health.overallStatus === 'warning') return 'health-dot-warn'
    return 'health-dot-error'
  }

  /**
   * Toggles between expanded and icon-only sidebar navigation and stores the preference locally.
   *
   * @returns Nothing.
   */
  const handleToggleCollapse = (): void => {
    setIsCollapsed((currentValue) => {
      const nextValue = !currentValue
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(nextValue))
      return nextValue
    })
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-project-meta">
          <div className="sidebar-project-name" title={project.name}>{project.name}</div>
        </div>
        <div className="sidebar-header-actions">
          <div className={`sidebar-health-dot ${healthDot()}`} title={
            health ? `Health: ${health.overallStatus}` : 'Loading health...'
          } />
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={handleToggleCollapse}
            aria-label={isCollapsed ? 'Expand project navigation' : 'Collapse project navigation'}
            title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {isCollapsed ? '\u203A' : '\u2039'}
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.path}
            type="button"
            className={`sidebar-nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            aria-label={item.label}
            title={isCollapsed ? item.label : undefined}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
            {item.label === 'Runs' && hasActiveRun && (
              <span className="sidebar-run-indicator" />
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className={`sidebar-nav-item ${isActive(`${base}/settings`) ? 'active' : ''}`}
          onClick={() => navigate(`${base}/settings`)}
          aria-label="Settings"
          title={isCollapsed ? 'Settings' : undefined}
        >
          <span className="sidebar-nav-icon" aria-hidden="true">{'\u2699'}</span>
          <span className="sidebar-nav-label">Settings</span>
        </button>
        <button
          type="button"
          className="sidebar-nav-item sidebar-back-link"
          onClick={() => navigate('/')}
          aria-label="Back to Projects"
          title={isCollapsed ? 'Back to Projects' : undefined}
        >
          <span className="sidebar-nav-icon" aria-hidden="true">{'\u2190'}</span>
          <span className="sidebar-nav-label">Back to Projects</span>
        </button>
      </div>
    </aside>
  )
}

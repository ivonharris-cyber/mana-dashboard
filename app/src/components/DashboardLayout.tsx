import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Home,
  Bot,
  Radio,
  GitBranch,
  Activity,
  Monitor,
  Network,
  Palmtree,
  Film,
  HardDrive,
  LogOut,
  Menu,
  X,
  Building2,
  Zap,
} from 'lucide-react'

const navItems = [
  { label: 'Command Center', path: '/', icon: Home },
  { label: 'Agents', path: '/agents', icon: Bot },
  { label: 'Swarm Command', path: '/swarm', icon: Zap },
  { label: 'Workflows', path: '/workflows', icon: GitBranch },
  { label: 'Island', path: '/island', icon: Palmtree },
  { label: 'Studio', path: '/studio', icon: Film },
  { label: 'Network', path: '/network', icon: Network },
  { label: 'Hapai', path: '/hapai', icon: Building2 },
]

const pageTitles: Record<string, string> = {
  '/': 'Command Center',
  '/agents': 'Agents',
  '/swarm': 'Swarm Command',
  '/workflows': 'Workflows',
  '/island': 'Mana Island',
  '/studio': 'Production Studio',
  '/network': 'Network',
  '/hapai': 'Hapai Intranet',
  '/system': 'System Manager',
  '/relay': 'Relay',
  '/services': 'Services',
  '/sessions': 'Sessions',
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const currentTitle =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith('/agents/') ? 'Agent Detail' : 'Dashboard')

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-void-dark border-r border-white/5
          flex flex-col transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h1 className="text-2xl font-bold text-neon-cyan tracking-tight">MANA</h1>
            <p className="text-xs text-white/40 mt-0.5">Command Center</p>
          </div>
          <button
            className="lg:hidden text-white/40 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/5 border-l-2 border-neon-cyan text-neon-cyan'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.03] border-l-2 border-transparent'
                }`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || user?.username || 'Admin'}
              </p>
              <p className="text-xs text-white/30 truncate">{user?.role || 'admin'}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-white/30 hover:text-agent-red hover:bg-white/5 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center gap-4 px-6 border-b border-white/5 bg-void-dark/50 backdrop-blur-sm shrink-0">
          <button
            className="lg:hidden text-white/50 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <h2 className="text-lg font-semibold text-white">{currentTitle}</h2>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import {
  RefreshCw,
  Monitor,
  Plus,
  Clock,
} from 'lucide-react'

interface Session {
  id: string | number
  name: string
  status: string
  location: string
  last_active?: string
  context?: string
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function SessionsPage() {
  const [localSessions, setLocalSessions] = useState<Session[]>([])
  const [serverSessions, setServerSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [creatingLocal, setCreatingLocal] = useState(false)
  const [creatingServer, setCreatingServer] = useState(false)

  const fetchSessions = useCallback(async () => {
    try {
      const [localRes, serverRes] = await Promise.allSettled([
        api.get('/sessions?location=local'),
        api.get('/sessions?location=server'),
      ])
      if (localRes.status === 'fulfilled') {
        const data = localRes.value
        setLocalSessions(Array.isArray(data) ? data : data?.sessions || [])
      }
      if (serverRes.status === 'fulfilled') {
        const data = serverRes.value
        setServerSessions(Array.isArray(data) ? data : data?.sessions || [])
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  async function handleSync() {
    setSyncing(true)
    try {
      await api.post('/sessions/sync')
      await fetchSessions()
    } catch {
      // silently handle
    } finally {
      setSyncing(false)
    }
  }

  async function handleNewSession(location: string) {
    const setCreating = location === 'local' ? setCreatingLocal : setCreatingServer
    setCreating(true)
    try {
      await api.post('/sessions', { location })
      await fetchSessions()
    } catch {
      // silently handle
    } finally {
      setCreating(false)
    }
  }

  function renderSessionCard(session: Session) {
    return (
      <div
        key={session.id}
        className="bg-void-gray rounded-lg p-4 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-white truncate">
            {session.name || `Session ${session.id}`}
          </h4>
          <StatusBadge status={session.status} size="sm" />
        </div>
        {session.last_active && (
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
            <Clock size={11} />
            Last active: {timeAgo(session.last_active)}
          </div>
        )}
        {session.context && (
          <p className="text-xs text-gray-400 mt-2 line-clamp-2 bg-void-black/50 rounded p-2 font-mono">
            {session.context}
          </p>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-neon-cyan animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Sessions</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2.5 rounded-lg hover:bg-neon-cyan/90 transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Sessions'}
        </button>
      </div>

      {/* Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Local Sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor size={16} className="text-cyan-400" />
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                Local Sessions
              </h3>
              <span className="text-xs bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded">
                {localSessions.length}
              </span>
            </div>
            <button
              onClick={() => handleNewSession('local')}
              disabled={creatingLocal}
              className="flex items-center gap-1 text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors disabled:opacity-50"
            >
              <Plus size={12} />
              {creatingLocal ? 'Creating...' : 'New Session'}
            </button>
          </div>
          <div className="space-y-2">
            {localSessions.length === 0 ? (
              <div className="bg-void-gray rounded-lg p-8 text-center">
                <Monitor size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/30">No local sessions</p>
              </div>
            ) : (
              localSessions.map(renderSessionCard)
            )}
          </div>
        </div>

        {/* Server Sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor size={16} className="text-purple-400" />
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                Server Sessions
              </h3>
              <span className="text-xs bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">
                {serverSessions.length}
              </span>
            </div>
            <button
              onClick={() => handleNewSession('server')}
              disabled={creatingServer}
              className="flex items-center gap-1 text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors disabled:opacity-50"
            >
              <Plus size={12} />
              {creatingServer ? 'Creating...' : 'New Session'}
            </button>
          </div>
          <div className="space-y-2">
            {serverSessions.length === 0 ? (
              <div className="bg-void-gray rounded-lg p-8 text-center">
                <Monitor size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/30">No server sessions</p>
              </div>
            ) : (
              serverSessions.map(renderSessionCard)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

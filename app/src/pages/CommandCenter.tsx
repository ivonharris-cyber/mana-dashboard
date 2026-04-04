import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { createSocket } from '../lib/socket'
import StatusBadge from '../components/StatusBadge'
import {
  Bot,
  Activity,
  MessageSquare,
  Monitor,
  RefreshCw,
  ChevronRight,
  Clock,
} from 'lucide-react'

interface Agent {
  id: string
  display_name: string
  model: string
  status: string
  color: string
  role?: string
}

interface RelayMessage {
  id: number
  source: string
  target: string
  type: string
  content: string
  created_at: string
}

interface ServiceHealth {
  name: string
  status: string
  response_time?: number
  last_checked?: string
}

interface MetricTile {
  label: string
  value: number
  icon: typeof Bot
  color: string
  bgClass: string
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

const sourceBadgeColors: Record<string, string> = {
  local: 'bg-cyan-500/10 text-cyan-400',
  server: 'bg-purple-500/10 text-purple-400',
  agent: 'bg-orange-500/10 text-orange-400',
}

export default function CommandCenter() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [relayMessages, setRelayMessages] = useState<RelayMessage[]>([])
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [sessionCount, setSessionCount] = useState(0)
  const [relayTotal, setRelayTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const relayRef = useRef<HTMLDivElement>(null)

  async function fetchData() {
    try {
      const [agentsRes, relayRes, servicesRes, sessionsRes] = await Promise.allSettled([
        api.get('/agents'),
        api.get('/relay?limit=10'),
        api.get('/services/health'),
        api.get('/sessions?status=active'),
      ])

      if (agentsRes.status === 'fulfilled') {
        setAgents(Array.isArray(agentsRes.value) ? agentsRes.value : agentsRes.value?.agents || [])
      }
      if (relayRes.status === 'fulfilled') {
        const data = relayRes.value
        const msgs = Array.isArray(data) ? data : data?.messages || []
        setRelayMessages(msgs)
        setRelayTotal(data?.total ?? msgs.length ?? 0)
      }
      if (servicesRes.status === 'fulfilled') {
        setServices(Array.isArray(servicesRes.value) ? servicesRes.value : servicesRes.value?.services || [])
      }
      if (sessionsRes.status === 'fulfilled') {
        const data = sessionsRes.value
        const arr = Array.isArray(data) ? data : data?.sessions || []
        setSessionCount(arr.length)
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    const socket = createSocket()
    socket.on('relay:new', (msg: RelayMessage) => {
      setRelayMessages((prev) => [msg, ...prev].slice(0, 10))
      setRelayTotal((prev) => prev + 1)
    })

    const interval = setInterval(fetchData, 10000)

    return () => {
      socket.disconnect()
      clearInterval(interval)
    }
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const activeAgents = agents.filter((a) => a.status !== 'offline').length
  const healthyServices = services.filter((s) => s.status === 'green' || s.status === 'healthy').length

  const tiles: MetricTile[] = [
    {
      label: 'Active Agents',
      value: activeAgents,
      icon: Bot,
      color: '#00D4FF',
      bgClass: 'bg-[#00D4FF]/10',
    },
    {
      label: 'Services Online',
      value: healthyServices,
      icon: Activity,
      color: '#22C55E',
      bgClass: 'bg-green-500/10',
    },
    {
      label: 'Relay Messages',
      value: relayTotal,
      icon: MessageSquare,
      color: '#A855F7',
      bgClass: 'bg-purple-500/10',
    },
    {
      label: 'Active Sessions',
      value: sessionCount,
      icon: Monitor,
      color: '#F97316',
      bgClass: 'bg-orange-500/10',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-neon-cyan animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="bg-void-gray border border-white/5 rounded-xl p-6 relative overflow-hidden"
          >
            <div className={`absolute top-4 right-4 p-2 rounded-lg ${tile.bgClass}`}>
              <tile.icon size={20} style={{ color: tile.color }} />
            </div>
            <div className="text-3xl font-bold text-white mt-2">{tile.value}</div>
            <div className="text-sm text-white/40 mt-1">{tile.label}</div>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Status Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
              Agent Status
            </h3>
            <button
              onClick={() => navigate('/agents')}
              className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.length === 0 && (
              <div className="col-span-2 text-sm text-white/30 bg-void-gray rounded-lg p-6 text-center">
                No agents configured yet
              </div>
            )}
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => navigate(`/agents/${agent.id}`)}
                className="bg-void-gray rounded-lg p-4 border-l-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                style={{ borderLeftColor: agent.color || '#6B7280' }}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {agent.display_name || agent.id}
                    </h4>
                    <span className="inline-block text-xs bg-white/5 text-white/50 px-2 py-0.5 rounded mt-1">
                      {agent.model}
                    </span>
                  </div>
                  <StatusBadge status={agent.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Relay Stream */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
              Live Relay
            </h3>
            <button
              onClick={() => navigate('/relay')}
              className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div
            ref={relayRef}
            className="space-y-2 max-h-[400px] overflow-y-auto pr-1"
          >
            {relayMessages.length === 0 && (
              <div className="text-sm text-white/30 bg-void-gray rounded-lg p-6 text-center">
                No relay messages yet
              </div>
            )}
            {relayMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-void-gray rounded-lg p-3 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      sourceBadgeColors[msg.source?.toLowerCase()] || 'bg-white/5 text-white/50'
                    }`}
                  >
                    {msg.source}
                  </span>
                  <ChevronRight size={10} className="text-white/20" />
                  <span className="text-[10px] text-white/40">{msg.target}</span>
                </div>
                <p className="text-xs text-white/70 line-clamp-2">{msg.content}</p>
                <div className="flex items-center gap-1 text-[10px] text-white/30">
                  <Clock size={10} />
                  {msg.created_at ? timeAgo(msg.created_at) : 'just now'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Service Health Row */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Service Health
          </h3>
          <button
            onClick={() => navigate('/services')}
            className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1 transition-colors"
          >
            View all <ChevronRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {services.length === 0 && (
            <div className="col-span-full text-sm text-white/30 bg-void-gray rounded-lg p-6 text-center">
              No services configured
            </div>
          )}
          {services.map((svc) => {
            const statusColor =
              svc.status === 'green' || svc.status === 'healthy'
                ? '#22C55E'
                : svc.status === 'amber' || svc.status === 'degraded'
                  ? '#F59E0B'
                  : '#EF4444'
            return (
              <div
                key={svc.name}
                className="bg-void-gray rounded-lg p-4 flex items-center gap-3"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: statusColor }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{svc.name}</p>
                  {svc.response_time !== undefined && (
                    <p className="text-xs text-white/30">{svc.response_time}ms</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

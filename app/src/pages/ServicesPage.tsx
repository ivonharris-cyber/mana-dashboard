import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import {
  RefreshCw,
  Bot,
  GitBranch,
  Wifi,
  Server,
  Globe,
  Activity,
  AlertTriangle,
} from 'lucide-react'

interface ServiceHealth {
  name: string
  status: string
  response_time?: number
  last_checked?: string
  details?: string
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

const serviceIcons: Record<string, typeof Bot> = {
  ollama: Bot,
  n8n: GitBranch,
  tailscale: Wifi,
  vps: Server,
  openclaw: Globe,
}

function getServiceIcon(name: string) {
  const lower = name.toLowerCase()
  for (const [key, Icon] of Object.entries(serviceIcons)) {
    if (lower.includes(key)) return Icon
  }
  return Activity
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'green' || s === 'healthy') return '#22C55E'
  if (s === 'amber' || s === 'degraded') return '#F59E0B'
  return '#EF4444'
}

function getStatusLabel(status: string): string {
  const s = status.toLowerCase()
  if (s === 'green' || s === 'healthy') return 'Healthy'
  if (s === 'amber' || s === 'degraded') return 'Degraded'
  return 'Offline'
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchServices = useCallback(async () => {
    try {
      const data = await api.get('/services/health')
      setServices(Array.isArray(data) ? data : data?.services || [])
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServices()
    intervalRef.current = setInterval(fetchServices, 30000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchServices])

  async function handleCheckAll() {
    setChecking(true)
    await fetchServices()
    setChecking(false)
  }

  const healthyCount = services.filter(
    (s) => s.status === 'green' || s.status === 'healthy'
  ).length
  const totalCount = services.length

  const overallStatus =
    healthyCount === totalCount
      ? 'green'
      : healthyCount > 0
        ? 'amber'
        : 'red'

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
        <h1 className="text-2xl font-bold text-white">Services</h1>
        <button
          onClick={handleCheckAll}
          disabled={checking}
          className="flex items-center gap-2 bg-white/5 border border-white/10 text-white/70 hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          Check All
        </button>
      </div>

      {/* Summary Bar */}
      <div
        className="rounded-xl p-4 border flex items-center gap-3"
        style={{
          backgroundColor: `${getStatusColor(overallStatus)}10`,
          borderColor: `${getStatusColor(overallStatus)}20`,
        }}
      >
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: getStatusColor(overallStatus) }}
        />
        <span className="text-sm font-medium" style={{ color: getStatusColor(overallStatus) }}>
          {healthyCount} of {totalCount} services healthy
        </span>
        {overallStatus !== 'green' && (
          <AlertTriangle
            size={16}
            className="ml-auto"
            style={{ color: getStatusColor(overallStatus) }}
          />
        )}
      </div>

      {/* Service Cards Grid */}
      {services.length === 0 ? (
        <div className="bg-void-gray border border-white/5 rounded-xl p-12 text-center">
          <Activity size={48} className="text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No services configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((svc) => {
            const statusColor = getStatusColor(svc.status)
            const statusLabel = getStatusLabel(svc.status)
            const isHealthy = svc.status === 'green' || svc.status === 'healthy'
            const Icon = getServiceIcon(svc.name)

            return (
              <div
                key={svc.name}
                className="bg-void-gray border border-white/5 rounded-xl p-6 hover:border-white/10 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Status indicator */}
                  <div className="relative shrink-0 mt-1">
                    {isHealthy && (
                      <span
                        className="absolute inset-0 rounded-full animate-ping opacity-40"
                        style={{ backgroundColor: statusColor }}
                      />
                    )}
                    <span
                      className="relative block w-4 h-4 rounded-full"
                      style={{ backgroundColor: statusColor }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-white truncate">{svc.name}</h3>
                      <Icon size={18} className="text-white/20 shrink-0" />
                    </div>
                    <p className="text-sm mt-1" style={{ color: statusColor }}>
                      {statusLabel}
                    </p>
                    {svc.response_time !== undefined && (
                      <p className="text-sm text-gray-400 mt-1">
                        Response: {svc.response_time}ms
                      </p>
                    )}
                    {svc.last_checked && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last checked: {timeAgo(svc.last_checked)}
                      </p>
                    )}
                    {svc.details && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <p className="text-xs text-gray-400">{svc.details}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

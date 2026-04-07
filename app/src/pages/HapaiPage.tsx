import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import {
  Building2, RefreshCw, ExternalLink, Activity,
  Users, Bell, Ticket, BookOpen, Radio,
  Heart, MapPin, Shield, MessageCircle
} from 'lucide-react'

interface HapaiStatus {
  status: string
  url: string
  uptime?: number
  error?: string
}

export default function HapaiPage() {
  const [hapai, setHapai] = useState<HapaiStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get('/hapai/status')
      setHapai(data)
    } catch {
      setHapai({ status: 'offline', url: 'http://192.168.17.55:3000', error: 'Cannot reach Mana API' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const isOnline = hapai?.status === 'online'

  const modules = [
    { icon: Users, label: 'Staff Directory', desc: 'Searchable contacts for all staff', path: '/directory', color: '#3B82F6' },
    { icon: Bell, label: 'Announcements', desc: 'Org-wide news and alerts', path: '/announcements', color: '#F59E0B' },
    { icon: Ticket, label: 'IT Help', desc: 'Submit IT support tickets', path: '/it-help', color: '#EF4444' },
    { icon: BookOpen, label: 'Te Reo Maori', desc: 'Language lessons and practice', path: '/tereo', color: '#22C55E' },
    { icon: MessageCircle, label: 'AI Assistant (Hera)', desc: 'Claude-powered org assistant', path: '/assistant', color: '#A855F7' },
    { icon: Heart, label: 'Health & Safety', desc: 'Report hazards and incidents', path: '/health-safety', color: '#EC4899' },
    { icon: MapPin, label: 'GPS Tracking', desc: 'Field staff location tracking', path: '/gps', color: '#14B8A6' },
    { icon: Radio, label: 'Kia Ora FM', desc: 'Communications & media resources', path: '/comms', color: '#F97316' },
    { icon: Shield, label: 'Privacy & Consent', desc: 'NZ Privacy Act 2020 compliance', path: '/settings/privacy', color: '#6366F1' },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-6 h-6 text-neon-cyan animate-spin" />
    </div>
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Hapai Intranet</h1>
          <p className="text-sm text-white/40 mt-1">Tanenuiarangi Ropu / Whakapai Hauora internal network</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchStatus}
            className="flex items-center gap-2 bg-white/5 text-white/50 px-3 py-2 rounded-lg text-sm hover:text-white transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          {hapai?.url && (
            <a href={hapai.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-neon-cyan/90 transition-colors">
              <ExternalLink size={14} /> Open Hapai
            </a>
          )}
        </div>
      </div>

      {/* Status Card */}
      <div className={`rounded-xl p-5 border ${isOnline ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
        <div className="flex items-center gap-4">
          <div className="relative">
            {isOnline && <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-40" />}
            <span className={`relative block w-4 h-4 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
          </div>
          <div>
            <p className={`text-sm font-medium ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
              {isOnline ? 'Hapai Intranet Online' : 'Hapai Intranet Offline'}
            </p>
            <p className="text-xs text-white/30 mt-0.5">
              {hapai?.url} {hapai?.uptime ? `| Uptime: ${Math.floor(hapai.uptime / 3600)}h ${Math.floor((hapai.uptime % 3600) / 60)}m` : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Activity size={16} className={isOnline ? 'text-green-400' : 'text-red-400'} />
          </div>
        </div>
      </div>

      {/* Integration Info */}
      <div className="bg-void-gray border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Integration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-white/40">Linked Agent:</span>
            <span className="text-green-400 ml-2 font-medium">Hapai (deepseek-coder-v2)</span>
          </div>
          <div>
            <span className="text-white/40">Stack:</span>
            <span className="text-white/70 ml-2">React + Express + SQLite</span>
          </div>
          <div>
            <span className="text-white/40">Auth:</span>
            <span className="text-white/70 ml-2">JWT + Google OAuth</span>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Modules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(m => (
            <a key={m.label} href={hapai?.url ? `${hapai.url}${m.path}` : '#'} target="_blank" rel="noopener noreferrer"
              className="bg-void-gray border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all group cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${m.color}15` }}>
                  <m.icon size={18} style={{ color: m.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white group-hover:text-neon-cyan transition-colors">{m.label}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{m.desc}</p>
                </div>
                <ExternalLink size={12} className="text-white/10 group-hover:text-white/30 transition-colors mt-1" />
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="bg-void-gray border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Architecture</h3>
        <div className="flex items-center gap-3 text-xs text-white/40">
          <div className="bg-neon-cyan/10 text-neon-cyan px-3 py-2 rounded-lg font-medium">Mana Dashboard<br/><span className="text-[10px] opacity-60">:3003</span></div>
          <span className="text-white/20">→</span>
          <div className="bg-green-500/10 text-green-400 px-3 py-2 rounded-lg font-medium">Hapai API<br/><span className="text-[10px] opacity-60">:3000</span></div>
          <span className="text-white/20">→</span>
          <div className="bg-purple-500/10 text-purple-400 px-3 py-2 rounded-lg font-medium">Claude AI<br/><span className="text-[10px] opacity-60">Anthropic</span></div>
          <span className="text-white/20">+</span>
          <div className="bg-yellow-500/10 text-yellow-400 px-3 py-2 rounded-lg font-medium">SQLite<br/><span className="text-[10px] opacity-60">hapai.db</span></div>
        </div>
      </div>
    </div>
  )
}

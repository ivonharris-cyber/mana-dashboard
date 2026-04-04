import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import InstallAgentModal from '../components/InstallAgentModal'
import { Plus, RefreshCw, Bot, Zap } from 'lucide-react'

interface Agent {
  id: string
  display_name: string
  model: string
  status: string
  color: string
  role_desc?: string
  level?: number
  xp?: number
  evolution_stage?: string
  memory_capacity?: number
  total_interactions?: number
}

const STAGE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  seed:   { label: 'Kakano',  icon: '\u{1F331}', color: '#A3E635' },
  sprout: { label: 'Pihi',    icon: '\u{1F33F}', color: '#22C55E' },
  bloom:  { label: 'Puawai',  icon: '\u{1F33A}', color: '#A855F7' },
  tane:   { label: 'Tane',    icon: '\u{1F333}', color: '#F59E0B' },
}

function xpForNextLevel(level: number) {
  return level * 100
}

export default function AgentsPage() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showInstall, setShowInstall] = useState(false)

  const fetchAgents = useCallback(async () => {
    try {
      const data = await api.get('/agents')
      setAgents(Array.isArray(data) ? data : data?.agents || [])
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  function handleInstallSuccess() {
    setShowInstall(false)
    fetchAgents()
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
        <h1 className="text-2xl font-bold text-white">Agents</h1>
        <button
          onClick={() => setShowInstall(true)}
          className="flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2.5 rounded-lg hover:bg-neon-cyan/90 transition-colors text-sm"
        >
          <Plus size={16} />
          Install New Agent
        </button>
      </div>

      {/* Agent Grid */}
      {agents.length === 0 ? (
        <div className="bg-void-gray border border-white/5 rounded-xl p-12 text-center">
          <Bot size={48} className="text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No agents installed yet</p>
          <button
            onClick={() => setShowInstall(true)}
            className="mt-4 text-neon-cyan text-sm hover:underline"
          >
            Install your first agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const level = agent.level || 1
            const xp = agent.xp || 0
            const xpNeeded = xpForNextLevel(level)
            const xpPercent = Math.min(100, Math.round((xp / xpNeeded) * 100))
            const stage = STAGE_CONFIG[agent.evolution_stage || 'seed'] || STAGE_CONFIG.seed

            return (
              <div
                key={agent.id}
                onClick={() => navigate(`/agents/${agent.id}`)}
                className="bg-void-gray border border-white/5 rounded-xl p-6 hover:border-white/10 cursor-pointer transition-all group relative overflow-hidden"
              >
                {/* Evolution glow on high level */}
                {level >= 10 && (
                  <div
                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${stage.color}, transparent 70%)` }}
                  />
                )}

                {/* Avatar + Info */}
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                      style={{
                        backgroundColor: `${agent.color || '#6B7280'}20`,
                        color: agent.color || '#6B7280',
                      }}
                    >
                      {(agent.display_name || agent.id).charAt(0).toUpperCase()}
                    </div>
                    {/* Evolution stage icon */}
                    <span
                      className="absolute -bottom-1 -right-1 text-sm"
                      title={`${stage.label} (Lv.${level})`}
                    >
                      {stage.icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-white truncate group-hover:text-neon-cyan transition-colors">
                      {agent.display_name || agent.id}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block text-xs bg-white/5 text-white/50 px-2 py-0.5 rounded">
                        {agent.model}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
                        style={{ backgroundColor: `${stage.color}15`, color: stage.color }}
                      >
                        <Zap size={10} />
                        Lv.{level}
                      </span>
                    </div>
                    {agent.role_desc && (
                      <p className="text-sm text-gray-400 mt-2 line-clamp-2">{agent.role_desc}</p>
                    )}
                  </div>
                </div>

                {/* XP Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] text-white/30 mb-1">
                    <span>{stage.label}</span>
                    <span>{xp}/{xpNeeded} XP</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${xpPercent}%`,
                        background: `linear-gradient(90deg, ${stage.color}80, ${stage.color})`,
                      }}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="absolute top-4 right-4">
                  <StatusBadge status={agent.status} size="sm" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Install Modal */}
      {showInstall && (
        <InstallAgentModal
          onClose={() => setShowInstall(false)}
          onSuccess={handleInstallSuccess}
        />
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import InstallAgentModal from '../components/InstallAgentModal'
import { Plus, RefreshCw, Bot } from 'lucide-react'

interface Agent {
  id: string
  display_name: string
  model: string
  status: string
  color: string
  role?: string
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
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => navigate(`/agents/${agent.id}`)}
              className="bg-void-gray border border-white/5 rounded-xl p-6 hover:border-white/10 cursor-pointer transition-all group relative"
            >
              {/* Avatar */}
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                  style={{
                    backgroundColor: `${agent.color || '#6B7280'}20`,
                    color: agent.color || '#6B7280',
                  }}
                >
                  {(agent.display_name || agent.id).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-white truncate group-hover:text-neon-cyan transition-colors">
                    {agent.display_name || agent.id}
                  </h3>
                  <span className="inline-block text-xs bg-white/5 text-white/50 px-2 py-1 rounded mt-1">
                    {agent.model}
                  </span>
                  {agent.role && (
                    <p className="text-sm text-gray-400 mt-2 line-clamp-2">{agent.role}</p>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="absolute bottom-4 right-4">
                <StatusBadge status={agent.status} size="sm" />
              </div>
            </div>
          ))}
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

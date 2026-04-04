import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import {
  Network,
  Globe,
  Server,
  Wifi,
  RefreshCw,
  Play,
  Square,
  MessageSquare,
  Radar,
  ChevronDown,
  ChevronRight,
  Plus,
  Zap,
  Terminal,
} from 'lucide-react'

interface Subnet {
  id: string
  name: string
  cidr: string | null
  gateway: string | null
  host_type: string
  tailscale_ip: string | null
  tailscale_name: string | null
  ollama_url: string | null
  ssh_host: string | null
  status: string
  last_seen: string | null
  agentCount: number
  onlineCount: number
}

interface Agent {
  id: string
  display_name: string
  name: string
  model: string
  status: string
  color: string
  role_desc: string
  host: string
  subnet_id: string
  bot_port: number | null
}

interface BotProcess {
  agent_id: string
  port: number
  pid: number
  status: string
  started_at: string
  last_heartbeat: string
}

interface TopologyNode {
  id: string
  name: string
  cidr: string | null
  gateway: string | null
  host_type: string
  tailscale_ip: string | null
  ollama_url: string | null
  status: string
  agents: (Agent & { process: BotProcess | null })[]
}

interface TailscalePeer {
  name: string
  ip: string
  os: string
  online: boolean
  isCat62: boolean
}

interface DiscoveryResult {
  tailscale: {
    connected: boolean
    self?: { name: string; ip: string; os: string }
    peers?: TailscalePeer[]
    error?: string
  } | null
  local: { addresses: string[] } | null
  errors: string[]
}

export default function NetworkPage() {
  const [topology, setTopology] = useState<TopologyNode[]>([])
  const [unassigned, setUnassigned] = useState<Agent[]>([])
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null)
  const [runningBots, setRunningBots] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['local-lan', 'vps-main', 'cat62', 'tailscale-mesh']))
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [deploying, setDeploying] = useState<string | null>(null)
  const [chatAgent, setChatAgent] = useState<string | null>(null)
  const [chatMsg, setChatMsg] = useState('')
  const [chatReply, setChatReply] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const fetchTopology = useCallback(async () => {
    try {
      const [topoData, botData] = await Promise.all([
        api.get('/network/topology'),
        api.get('/bots'),
      ])
      setTopology(topoData.topology || [])
      setUnassigned(topoData.unassigned || [])
      setRunningBots(botData.running || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTopology()
    const interval = setInterval(fetchTopology, 10000)
    return () => clearInterval(interval)
  }, [fetchTopology])

  async function runDiscover() {
    setDiscovering(true)
    try {
      const data = await api.get('/network/discover')
      setDiscovery(data)
      fetchTopology()
    } catch {
      // silent
    } finally {
      setDiscovering(false)
    }
  }

  async function deployBot(agentId: string) {
    setDeploying(agentId)
    try {
      await api.post(`/bots/deploy/${agentId}`, {})
      fetchTopology()
    } catch {
      // silent
    } finally {
      setDeploying(null)
    }
  }

  async function stopBotHandler(agentId: string) {
    try {
      await api.post(`/bots/stop/${agentId}`, {})
      fetchTopology()
    } catch {
      // silent
    }
  }

  async function deployAll(subnetId: string) {
    setDeploying(subnetId)
    try {
      await api.post(`/bots/deploy-all/${subnetId}`, {})
      fetchTopology()
    } catch {
      // silent
    } finally {
      setDeploying(null)
    }
  }

  async function sendChat(agentId: string) {
    if (!chatMsg.trim()) return
    setChatLoading(true)
    setChatReply('')
    try {
      const data = await api.post(`/bots/chat/${agentId}`, { message: chatMsg })
      setChatReply(data.reply || data.error || 'No response')
    } catch (err: any) {
      setChatReply(`Error: ${err.message}`)
    } finally {
      setChatLoading(false)
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const hostIcon = (type: string) => {
    switch (type) {
      case 'local': return <Server size={18} className="text-agent-green" />
      case 'vps': return <Globe size={18} className="text-agent-orange" />
      case 'tailscale': return <Wifi size={18} className="text-agent-purple" />
      default: return <Network size={18} className="text-white/50" />
    }
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
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Network size={24} className="text-neon-cyan" />
          Network Topology
        </h1>
        <button
          onClick={runDiscover}
          disabled={discovering}
          className="flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2.5 rounded-lg hover:bg-neon-cyan/90 transition-colors text-sm disabled:opacity-50"
        >
          {discovering ? <RefreshCw size={16} className="animate-spin" /> : <Radar size={16} />}
          {discovering ? 'Scanning...' : 'Discover Network'}
        </button>
      </div>

      {/* Discovery Results */}
      {discovery && (
        <div className="bg-void-gray border border-white/5 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Discovery Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tailscale */}
            <div className="bg-void-dark rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wifi size={16} className="text-agent-purple" />
                <span className="text-sm font-semibold text-white">Tailscale</span>
                <StatusBadge status={discovery.tailscale?.connected ? 'online' : 'offline'} size="sm" />
              </div>
              {discovery.tailscale?.connected ? (
                <div className="space-y-1 text-xs">
                  <p className="text-white/50">Self: <span className="text-white">{discovery.tailscale.self?.name}</span> ({discovery.tailscale.self?.ip})</p>
                  <p className="text-white/50">{discovery.tailscale.peers?.length || 0} peer(s):</p>
                  {discovery.tailscale.peers?.map((p) => (
                    <div key={p.name} className={`ml-2 flex items-center gap-2 ${p.isCat62 ? 'text-neon-cyan font-semibold' : 'text-white/40'}`}>
                      <span className={`w-2 h-2 rounded-full ${p.online ? 'bg-agent-green' : 'bg-agent-red'}`} />
                      {p.name} ({p.ip}) {p.isCat62 && '← cat62'}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-agent-red">{discovery.tailscale?.error || 'Not connected'}</p>
              )}
            </div>

            {/* Local */}
            <div className="bg-void-dark rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Server size={16} className="text-agent-green" />
                <span className="text-sm font-semibold text-white">Local Network</span>
              </div>
              {discovery.local?.addresses?.length ? (
                <div className="space-y-1 text-xs">
                  {discovery.local.addresses.map((addr) => (
                    <p key={addr} className="text-white/60 font-mono">{addr}</p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40">No addresses found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Running Bots Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-void-gray border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/40 uppercase">Subnets</p>
          <p className="text-2xl font-bold text-white mt-1">{topology.length}</p>
        </div>
        <div className="bg-void-gray border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/40 uppercase">Total Agents</p>
          <p className="text-2xl font-bold text-white mt-1">
            {topology.reduce((sum, s) => sum + s.agents.length, 0) + unassigned.length}
          </p>
        </div>
        <div className="bg-void-gray border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/40 uppercase">Bots Running</p>
          <p className="text-2xl font-bold text-agent-green mt-1">{runningBots.length}</p>
        </div>
        <div className="bg-void-gray border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/40 uppercase">Subnets Online</p>
          <p className="text-2xl font-bold text-neon-cyan mt-1">
            {topology.filter((s) => s.status === 'online').length}
          </p>
        </div>
      </div>

      {/* Subnet Tree */}
      <div className="space-y-3">
        {topology.map((subnet) => (
          <div key={subnet.id} className="bg-void-gray border border-white/5 rounded-xl overflow-hidden">
            {/* Subnet Header */}
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => toggleExpand(subnet.id)}
            >
              <div className="flex items-center gap-3">
                {expanded.has(subnet.id) ? <ChevronDown size={16} className="text-white/30" /> : <ChevronRight size={16} className="text-white/30" />}
                {hostIcon(subnet.host_type)}
                <div>
                  <h3 className="text-white font-semibold">{subnet.name}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    {subnet.cidr && <span className="text-xs text-white/30 font-mono">{subnet.cidr}</span>}
                    {subnet.tailscale_ip && <span className="text-xs text-agent-purple font-mono">ts:{subnet.tailscale_ip}</span>}
                    {subnet.ollama_url && <span className="text-xs text-white/20">{subnet.ollama_url}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/30">
                  {subnet.agents.length} agent{subnet.agents.length !== 1 ? 's' : ''}
                </span>
                <StatusBadge status={subnet.status || 'unknown'} size="sm" />
                <button
                  onClick={(e) => { e.stopPropagation(); deployAll(subnet.id); }}
                  disabled={deploying === subnet.id || subnet.agents.length === 0}
                  className="flex items-center gap-1 text-xs bg-agent-green/10 text-agent-green px-2 py-1 rounded hover:bg-agent-green/20 disabled:opacity-30"
                  title="Deploy all agents on this subnet"
                >
                  <Zap size={12} />
                  Deploy All
                </button>
              </div>
            </div>

            {/* Agent List */}
            {expanded.has(subnet.id) && subnet.agents.length > 0 && (
              <div className="border-t border-white/5">
                {subnet.agents.map((agent) => {
                  const isRunning = agent.status === 'online' || agent.process?.status === 'running'
                  return (
                    <div key={agent.id} className="flex items-center justify-between px-5 py-3 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.01]">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{
                            backgroundColor: `${agent.color || '#6B7280'}20`,
                            color: agent.color || '#6B7280',
                          }}
                        >
                          {(agent.display_name || agent.id).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{agent.display_name || agent.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{agent.model}</span>
                            <span className="text-xs text-white/20">{agent.role_desc}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {agent.process && (
                          <span className="text-xs text-white/20 font-mono">:{agent.process.port}</span>
                        )}
                        <StatusBadge status={agent.status} size="sm" />
                        {isRunning ? (
                          <>
                            <button
                              onClick={() => { setChatAgent(chatAgent === agent.id ? null : agent.id); setChatReply(''); setChatMsg(''); }}
                              className="flex items-center gap-1 text-xs bg-neon-cyan/10 text-neon-cyan px-2 py-1 rounded hover:bg-neon-cyan/20"
                            >
                              <MessageSquare size={12} />
                              Chat
                            </button>
                            <button
                              onClick={() => stopBotHandler(agent.id)}
                              className="flex items-center gap-1 text-xs bg-agent-red/10 text-agent-red px-2 py-1 rounded hover:bg-agent-red/20"
                            >
                              <Square size={12} />
                              Stop
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => deployBot(agent.id)}
                            disabled={deploying === agent.id}
                            className="flex items-center gap-1 text-xs bg-agent-green/10 text-agent-green px-2 py-1 rounded hover:bg-agent-green/20 disabled:opacity-50"
                          >
                            {deploying === agent.id ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                            Deploy
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Inline Chat Panel */}
                {chatAgent && subnet.agents.some((a) => a.id === chatAgent) && (
                  <div className="px-5 py-3 border-t border-neon-cyan/20 bg-void-dark/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal size={14} className="text-neon-cyan" />
                      <span className="text-xs font-semibold text-neon-cyan">Chat with {chatAgent}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatMsg}
                        onChange={(e) => setChatMsg(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendChat(chatAgent)}
                        placeholder="Type a message..."
                        className="flex-1 bg-void-gray border border-white/10 rounded px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-neon-cyan/50"
                      />
                      <button
                        onClick={() => sendChat(chatAgent)}
                        disabled={chatLoading}
                        className="bg-neon-cyan text-void-black font-semibold px-4 py-2 rounded text-sm disabled:opacity-50"
                      >
                        {chatLoading ? '...' : 'Send'}
                      </button>
                    </div>
                    {chatReply && (
                      <div className="mt-2 p-3 bg-void-gray rounded text-sm text-white/80 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {chatReply}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {expanded.has(subnet.id) && subnet.agents.length === 0 && (
              <div className="border-t border-white/5 px-5 py-6 text-center text-sm text-white/20">
                No agents assigned to this subnet
              </div>
            )}
          </div>
        ))}

        {/* Unassigned Agents */}
        {unassigned.length > 0 && (
          <div className="bg-void-gray border border-white/5 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <Plus size={16} className="text-white/30" />
              <h3 className="text-white/50 font-semibold">Unassigned ({unassigned.length})</h3>
            </div>
            <div className="border-t border-white/5">
              {unassigned.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between px-5 py-3 border-b border-white/[0.03] last:border-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                    >
                      {(agent.display_name || agent.id).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-white">{agent.display_name}</span>
                    <span className="text-xs text-white/30">{agent.model}</span>
                  </div>
                  <StatusBadge status={agent.status} size="sm" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

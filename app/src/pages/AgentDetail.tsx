import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import {
  ChevronRight,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
  Brain,
  Plus,
  Trash2,
} from 'lucide-react'

interface Agent {
  id: string
  display_name: string
  model: string
  status: string
  color: string
  role_desc?: string
  telegram_token?: string
  telegram_active?: boolean
  level?: number
  xp?: number
  evolution_stage?: string
  memory_capacity?: number
  total_interactions?: number
}

interface EvolutionData {
  level: number
  xp: number
  xpNeeded: number
  xpPercent: number
  stage: string
  stageLabel: string
  stageColor: string
  memoryCapacity: number
  memoryUsed: number
  totalInteractions: number
  stages: { id: string; label: string; minLevel: number; memoryCapacity: number; color: string }[]
}

interface Memory {
  id: number
  agent_id: string
  type: string
  content: string
  importance: number
  source: string
  created_at: string
}

const STAGE_ICONS: Record<string, string> = {
  seed: '\u{1F331}',
  sprout: '\u{1F33F}',
  bloom: '\u{1F33A}',
  tane: '\u{1F333}',
}

const MODEL_OPTIONS = [
  'nous-hermes2',
  'qwen3.5:35b',
  'llama3.1:8b',
  'deepseek-coder-v2',
  'mixtral-creative',
  'grok-3',
  'grok-3-mini',
  'grok-3-reasoning-gemma3-12b',
  'grok-3-reasoning-gemma3-4b',
  'grok-2',
  'grok-1',
]

const MEMORY_TYPES = ['fact', 'conversation', 'skill', 'insight', 'directive']

const TABS = ['SOUL.md', 'Model', 'Memory Bank', 'Telegram', 'History'] as const
type TabName = (typeof TABS)[number]

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabName>('SOUL.md')

  // SOUL.md state
  const [soulContent, setSoulContent] = useState('')
  const [soulOriginal, setSoulOriginal] = useState('')
  const [soulSaving, setSoulSaving] = useState(false)
  const [soulSaved, setSoulSaved] = useState(false)

  // Model state
  const [selectedModel, setSelectedModel] = useState('')
  const [modelSaving, setModelSaving] = useState(false)
  const [modelSaved, setModelSaved] = useState(false)

  // Telegram state
  const [telegramToken, setTelegramToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [telegramSaving, setTelegramSaving] = useState(false)
  const [telegramSaved, setTelegramSaved] = useState(false)

  // Evolution state
  const [evolution, setEvolution] = useState<EvolutionData | null>(null)

  // Memory bank state
  const [memories, setMemories] = useState<Memory[]>([])
  const [memCapacity, setMemCapacity] = useState(10)
  const [newMemContent, setNewMemContent] = useState('')
  const [newMemType, setNewMemType] = useState('fact')
  const [newMemImportance, setNewMemImportance] = useState(3)
  const [memSaving, setMemSaving] = useState(false)

  const fetchAgent = useCallback(async () => {
    if (!id) return
    try {
      const data = await api.get(`/agents/${id}`)
      const a = data?.agent || data
      setAgent(a)
      setSelectedModel(a.model || '')
      setTelegramToken(a.telegram_token || '')
    } catch {
      navigate('/agents')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  const fetchSoul = useCallback(async () => {
    if (!id) return
    try {
      const data = await api.get(`/agents/${id}/soul`)
      const content = data?.content || ''
      setSoulContent(content)
      setSoulOriginal(content)
    } catch {
      setSoulContent('')
      setSoulOriginal('')
    }
  }, [id])

  const fetchEvolution = useCallback(async () => {
    if (!id) return
    try {
      const data = await api.get(`/agents/${id}/evolution`)
      setEvolution(data)
    } catch {
      // evolution data not available
    }
  }, [id])

  const fetchMemories = useCallback(async () => {
    if (!id) return
    try {
      const data = await api.get(`/agents/${id}/memories`)
      setMemories(data?.memories || [])
      setMemCapacity(data?.capacity || 10)
    } catch {
      // no memories yet
    }
  }, [id])

  useEffect(() => {
    fetchAgent()
    fetchSoul()
    fetchEvolution()
    fetchMemories()
  }, [fetchAgent, fetchSoul, fetchEvolution, fetchMemories])

  async function handleSaveSoul() {
    if (!id) return
    setSoulSaving(true)
    setSoulSaved(false)
    try {
      await api.put(`/agents/${id}/soul`, { content: soulContent })
      setSoulOriginal(soulContent)
      setSoulSaved(true)
      setTimeout(() => setSoulSaved(false), 2000)
    } catch { /* */ } finally {
      setSoulSaving(false)
    }
  }

  async function handleSaveModel() {
    if (!id) return
    setModelSaving(true)
    setModelSaved(false)
    try {
      await api.put(`/agents/${id}`, { model: selectedModel })
      setAgent((prev) => (prev ? { ...prev, model: selectedModel } : prev))
      setModelSaved(true)
      setTimeout(() => setModelSaved(false), 2000)
    } catch { /* */ } finally {
      setModelSaving(false)
    }
  }

  async function handleSaveTelegram() {
    if (!id) return
    setTelegramSaving(true)
    setTelegramSaved(false)
    try {
      await api.put(`/agents/${id}`, { telegram_token: telegramToken })
      setAgent((prev) => (prev ? { ...prev, telegram_token: telegramToken } : prev))
      setTelegramSaved(true)
      setTimeout(() => setTelegramSaved(false), 2000)
    } catch { /* */ } finally {
      setTelegramSaving(false)
    }
  }

  async function handleAddMemory() {
    if (!id || !newMemContent.trim()) return
    setMemSaving(true)
    try {
      await api.post(`/agents/${id}/memories`, {
        content: newMemContent.trim(),
        type: newMemType,
        importance: newMemImportance,
        source: 'manual',
      })
      setNewMemContent('')
      setNewMemImportance(3)
      fetchMemories()
      fetchEvolution()
    } catch { /* */ } finally {
      setMemSaving(false)
    }
  }

  async function handleDeleteMemory(memId: number) {
    if (!id) return
    try {
      await api.delete(`/agents/${id}/memories/${memId}`)
      fetchMemories()
    } catch { /* */ }
  }

  if (loading || !agent) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-neon-cyan animate-spin" />
      </div>
    )
  }

  const soulDirty = soulContent !== soulOriginal
  const stageIcon = STAGE_ICONS[evolution?.stage || agent.evolution_stage || 'seed']
  const stageColor = evolution?.stageColor || '#A3E635'

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header with Evolution */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/agents')}
          className="text-white/40 hover:text-white transition-colors"
        >
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div className="relative">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
            style={{
              backgroundColor: `${agent.color || '#6B7280'}20`,
              color: agent.color || '#6B7280',
              boxShadow: (agent.level || 1) >= 10 ? `0 0 20px ${stageColor}30` : undefined,
            }}
          >
            {(agent.display_name || agent.id).charAt(0).toUpperCase()}
          </div>
          <span className="absolute -bottom-1 -right-1 text-base">{stageIcon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-white truncate">
            {agent.display_name || agent.id}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs bg-white/5 text-white/50 px-2 py-0.5 rounded">
              {agent.model}
            </span>
            <StatusBadge status={agent.status} size="sm" />
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-bold"
              style={{ backgroundColor: `${stageColor}15`, color: stageColor }}
            >
              <Zap size={10} />
              Lv.{evolution?.level || agent.level || 1}
            </span>
            <span className="text-xs text-white/30">
              {evolution?.stageLabel || 'Kakano'}
            </span>
          </div>
          {/* XP Progress Bar */}
          {evolution && (
            <div className="mt-2 max-w-xs">
              <div className="flex items-center justify-between text-[10px] text-white/30 mb-0.5">
                <span>{evolution.xp} / {evolution.xpNeeded} XP</span>
                <span>{evolution.totalInteractions} interactions</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${evolution.xpPercent}%`,
                    background: `linear-gradient(90deg, ${stageColor}80, ${stageColor})`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Evolution Timeline */}
      {evolution?.stages && (
        <div className="flex items-center gap-1 px-2">
          {evolution.stages.map((s, i) => {
            const reached = (evolution.level || 1) >= s.minLevel
            const current = evolution.stage === s.id
            return (
              <div key={s.id} className="flex items-center gap-1">
                {i > 0 && (
                  <div
                    className="h-0.5 w-8"
                    style={{ backgroundColor: reached ? s.color : 'rgba(255,255,255,0.05)' }}
                  />
                )}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                    current
                      ? 'ring-1 ring-offset-1 ring-offset-void-black'
                      : ''
                  }`}
                  style={{
                    backgroundColor: reached ? `${s.color}15` : 'rgba(255,255,255,0.02)',
                    color: reached ? s.color : 'rgba(255,255,255,0.2)',
                    ringColor: current ? s.color : undefined,
                  }}
                >
                  <span>{STAGE_ICONS[s.id]}</span>
                  <span>{s.label}</span>
                  <span className="opacity-50">Lv.{s.minLevel}+</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex border-b border-white/5">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-neon-cyan'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tab === 'Memory Bank' && (
              <Brain size={12} className="inline mr-1.5 -mt-0.5" />
            )}
            {tab}
            {tab === 'Memory Bank' && (
              <span className="ml-1.5 text-[10px] text-white/30">
                {memories.length}/{memCapacity}
              </span>
            )}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-cyan" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-0">
        {/* SOUL.md Tab */}
        {activeTab === 'SOUL.md' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">
                Edit the SOUL.md personality file for this agent
              </p>
              <button
                onClick={handleSaveSoul}
                disabled={soulSaving || !soulDirty}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  soulSaved
                    ? 'bg-green-500/20 text-green-400'
                    : soulDirty
                      ? 'bg-neon-cyan text-void-black hover:bg-neon-cyan/90'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                }`}
              >
                <Save size={14} />
                {soulSaving ? 'Saving...' : soulSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 340px)' }}>
              <textarea
                value={soulContent}
                onChange={(e) => setSoulContent(e.target.value)}
                className="w-full h-full bg-void-black border border-white/10 rounded-lg p-4 text-sm text-white font-mono resize-none focus:outline-none focus:border-neon-cyan/30 transition-colors"
                placeholder={'# Agent SOUL.md\n\nDefine the personality, goals, and behavior rules for this agent...'}
                spellCheck={false}
              />
              <div className="h-full bg-void-gray border border-white/5 rounded-lg p-4 overflow-y-auto prose prose-invert prose-sm max-w-none prose-headings:text-neon-cyan prose-a:text-neon-blue prose-code:text-pink-400 prose-strong:text-white">
                {soulContent ? (
                  <ReactMarkdown>{soulContent}</ReactMarkdown>
                ) : (
                  <p className="text-white/20 italic">Preview will appear here...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Model Tab */}
        {activeTab === 'Model' && (
          <div className="max-w-md space-y-6">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Current Model</label>
              <div className="text-sm text-white bg-void-gray border border-white/5 rounded-lg px-4 py-3">
                {agent.model}
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Change Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-void-black border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-cyan/50 transition-colors appearance-none cursor-pointer"
              >
                {MODEL_OPTIONS.map((model) => (
                  <option key={model} value={model} className="bg-void-dark">
                    {model}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSaveModel}
              disabled={modelSaving || selectedModel === agent.model}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                modelSaved
                  ? 'bg-green-500/20 text-green-400'
                  : selectedModel !== agent.model
                    ? 'bg-neon-cyan text-void-black hover:bg-neon-cyan/90'
                    : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              <Save size={14} />
              {modelSaving ? 'Saving...' : modelSaved ? 'Saved!' : 'Save Model'}
            </button>
          </div>
        )}

        {/* Memory Bank Tab */}
        {activeTab === 'Memory Bank' && (
          <div className="space-y-6">
            {/* Capacity bar */}
            <div className="bg-void-gray border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain size={16} style={{ color: stageColor }} />
                  <span className="text-sm font-medium text-white">Memory Capacity</span>
                </div>
                <span className="text-sm text-white/50">
                  {memories.length} / {memCapacity} slots
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (memories.length / memCapacity) * 100)}%`,
                    background: memories.length >= memCapacity
                      ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                      : `linear-gradient(90deg, ${stageColor}80, ${stageColor})`,
                  }}
                />
              </div>
              <p className="text-[10px] text-white/30 mt-1.5">
                Evolve to unlock more memory slots. Current stage: {evolution?.stageLabel || 'Kakano'}
              </p>
            </div>

            {/* Add memory form */}
            <div className="bg-void-gray border border-white/5 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Plus size={14} className="text-neon-cyan" />
                Teach New Memory
              </h3>
              <textarea
                value={newMemContent}
                onChange={(e) => setNewMemContent(e.target.value)}
                className="w-full h-20 bg-void-black border border-white/10 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-neon-cyan/30 transition-colors"
                placeholder="Teach this agent something... facts, skills, directives, insights"
              />
              <div className="flex items-center gap-3">
                <select
                  value={newMemType}
                  onChange={(e) => setNewMemType(e.target.value)}
                  className="bg-void-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan/50 appearance-none cursor-pointer"
                >
                  {MEMORY_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-void-dark">{t}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">Importance:</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNewMemImportance(n)}
                      className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                        n <= newMemImportance
                          ? 'bg-neon-cyan/20 text-neon-cyan'
                          : 'bg-white/5 text-white/20'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAddMemory}
                  disabled={memSaving || !newMemContent.trim()}
                  className="ml-auto flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2 rounded-lg hover:bg-neon-cyan/90 transition-colors text-xs disabled:opacity-30"
                >
                  <Brain size={12} />
                  {memSaving ? 'Teaching...' : 'Teach'}
                </button>
              </div>
            </div>

            {/* Memory entries */}
            <div className="space-y-2">
              {memories.length === 0 ? (
                <div className="text-center py-12">
                  <Brain size={32} className="text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/30">No memories yet</p>
                  <p className="text-xs text-white/20 mt-1">Teach this agent facts, skills, and directives</p>
                </div>
              ) : (
                memories.map((mem) => {
                  const typeColors: Record<string, string> = {
                    fact: '#3B82F6',
                    conversation: '#A855F7',
                    skill: '#22C55E',
                    insight: '#F59E0B',
                    directive: '#EF4444',
                  }
                  const tc = typeColors[mem.type] || '#6B7280'
                  return (
                    <div
                      key={mem.id}
                      className="bg-void-gray border border-white/5 rounded-lg p-3 flex items-start gap-3 group"
                    >
                      <div
                        className="w-1 h-full min-h-[2rem] rounded-full shrink-0"
                        style={{ backgroundColor: tc }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${tc}15`, color: tc }}
                          >
                            {mem.type}
                          </span>
                          <span className="text-[10px] text-white/20">
                            imp: {mem.importance}/5
                          </span>
                          <span className="text-[10px] text-white/20">
                            {mem.source}
                          </span>
                        </div>
                        <p className="text-sm text-white/70">{mem.content}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteMemory(mem.id) }}
                        className="text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Telegram Tab */}
        {activeTab === 'Telegram' && (
          <div className="max-w-md space-y-6">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Bot Token</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="w-full bg-void-black border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-sm text-white font-mono placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                  placeholder="Enter Telegram bot token"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Bot Status</label>
              <div className="bg-void-gray border border-white/5 rounded-lg px-4 py-3">
                <StatusBadge
                  status={agent.telegram_active ? 'online' : 'offline'}
                  label={agent.telegram_active ? 'Connected' : 'Not connected'}
                />
              </div>
            </div>
            <button
              onClick={handleSaveTelegram}
              disabled={telegramSaving || telegramToken === (agent.telegram_token || '')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                telegramSaved
                  ? 'bg-green-500/20 text-green-400'
                  : telegramToken !== (agent.telegram_token || '')
                    ? 'bg-neon-cyan text-void-black hover:bg-neon-cyan/90'
                    : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              <Save size={14} />
              {telegramSaving ? 'Saving...' : telegramSaved ? 'Saved!' : 'Save Token'}
            </button>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'History' && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <RefreshCw size={24} className="text-white/20" />
              </div>
              <p className="text-white/40 text-sm">Task history coming soon</p>
              <p className="text-white/20 text-xs mt-1">
                Agent execution logs and task results will appear here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

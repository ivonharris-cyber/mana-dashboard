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
} from 'lucide-react'

interface Agent {
  id: string
  display_name: string
  model: string
  status: string
  color: string
  role?: string
  telegram_token?: string
  telegram_active?: boolean
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

const TABS = ['SOUL.md', 'Model', 'Telegram', 'History'] as const
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

  const fetchAgent = useCallback(async () => {
    if (!id) return
    try {
      const data = await api.get(`/agents/${id}`)
      setAgent(data)
      setSelectedModel(data.model || '')
      setTelegramToken(data.telegram_token || '')
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

  useEffect(() => {
    fetchAgent()
    fetchSoul()
  }, [fetchAgent, fetchSoul])

  async function handleSaveSoul() {
    if (!id) return
    setSoulSaving(true)
    setSoulSaved(false)
    try {
      await api.put(`/agents/${id}/soul`, { content: soulContent })
      setSoulOriginal(soulContent)
      setSoulSaved(true)
      setTimeout(() => setSoulSaved(false), 2000)
    } catch {
      // handle error silently
    } finally {
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
    } catch {
      // handle error silently
    } finally {
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
    } catch {
      // handle error silently
    } finally {
      setTelegramSaving(false)
    }
  }

  if (loading || !agent) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-neon-cyan animate-spin" />
      </div>
    )
  }

  const soulDirty = soulContent !== soulOriginal

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/agents')}
          className="text-white/40 hover:text-white transition-colors"
        >
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
          style={{
            backgroundColor: `${agent.color || '#6B7280'}20`,
            color: agent.color || '#6B7280',
          }}
        >
          {(agent.display_name || agent.id).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white truncate">
            {agent.display_name || agent.id}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs bg-white/5 text-white/50 px-2 py-0.5 rounded">
              {agent.model}
            </span>
            <StatusBadge status={agent.status} size="sm" />
          </div>
        </div>
      </div>

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
            {tab}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 300px)' }}>
              {/* Editor */}
              <textarea
                value={soulContent}
                onChange={(e) => setSoulContent(e.target.value)}
                className="w-full h-full bg-void-black border border-white/10 rounded-lg p-4 text-sm text-white font-mono resize-none focus:outline-none focus:border-neon-cyan/30 transition-colors"
                placeholder={'# Agent SOUL.md\n\nDefine the personality, goals, and behavior rules for this agent...'}
                spellCheck={false}
              />
              {/* Preview */}
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

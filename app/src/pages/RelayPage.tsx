import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import { createSocket } from '../lib/socket'
import {
  Send,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react'

interface RelayMessage {
  id: number
  source: string
  target: string
  type: string
  content: string
  created_at: string
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
  local: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  server: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  agent: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

const typeBadgeColors: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-400',
  command: 'bg-cyan-500/10 text-cyan-400',
  response: 'bg-green-500/10 text-green-400',
  error: 'bg-red-500/10 text-red-400',
}

const SOURCE_OPTIONS = ['All', 'Local', 'Server', 'Agent']
const TYPE_OPTIONS = ['All', 'info', 'command', 'response', 'error']
const TARGET_OPTIONS = ['Local', 'Server', 'Agent']

export default function RelayPage() {
  const [messages, setMessages] = useState<RelayMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSource, setFilterSource] = useState('All')
  const [filterType, setFilterType] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Send form state
  const [sendSource, setSendSource] = useState('Local')
  const [sendTarget, setSendTarget] = useState('Server')
  const [sendType, setSendType] = useState('info')
  const [sendContent, setSendContent] = useState('')
  const [sending, setSending] = useState(false)
  const [showSendForm, setShowSendForm] = useState(false)

  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (filterSource !== 'All') params.set('source', filterSource.toLowerCase())
      if (filterType !== 'All') params.set('type', filterType)
      const data = await api.get(`/relay?${params.toString()}`)
      const msgs = Array.isArray(data) ? data : data?.messages || []
      setMessages(msgs)
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [filterSource, filterType])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    const socket = createSocket()
    socketRef.current = socket

    socket.on('relay:new', (msg: RelayMessage) => {
      setMessages((prev) => [msg, ...prev].slice(0, 100))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  // Auto-scroll to top when new messages arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [messages.length])

  async function handleSend() {
    if (!sendContent.trim()) return
    setSending(true)
    try {
      await api.post('/relay', {
        source: sendSource.toLowerCase(),
        target: sendTarget.toLowerCase(),
        type: sendType,
        content: sendContent.trim(),
      })
      if (socketRef.current) {
        socketRef.current.emit('relay:send', {
          source: sendSource.toLowerCase(),
          target: sendTarget.toLowerCase(),
          type: sendType,
          content: sendContent.trim(),
        })
      }
      setSendContent('')
      fetchMessages()
    } catch {
      // handle error
    } finally {
      setSending(false)
    }
  }

  const filteredMessages = messages.filter((msg) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !msg.content?.toLowerCase().includes(q) &&
        !msg.source?.toLowerCase().includes(q) &&
        !msg.target?.toLowerCase().includes(q)
      ) {
        return false
      }
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-neon-cyan animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-up flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold text-white">Relay</h1>
        <button
          onClick={() => setShowSendForm(!showSendForm)}
          className="flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2.5 rounded-lg hover:bg-neon-cyan/90 transition-colors text-sm"
        >
          <Send size={16} />
          Send Message
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-white/30" />
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="bg-void-gray border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-neon-cyan/50 transition-colors appearance-none cursor-pointer"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s} className="bg-void-dark">
                {s === 'All' ? 'All Sources' : s}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-void-gray border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-neon-cyan/50 transition-colors appearance-none cursor-pointer"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t} className="bg-void-dark">
                {t === 'All' ? 'All Types' : t}
              </option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-void-gray border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 transition-colors"
            placeholder="Search messages..."
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <span className="text-xs text-white/30">{filteredMessages.length} messages</span>
      </div>

      {/* Message List */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-white/30">No messages found</p>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className="bg-void-gray rounded-lg p-4 mb-2 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center flex-wrap gap-2 mb-2">
                {/* Source badge */}
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded border ${
                    sourceBadgeColors[msg.source?.toLowerCase()] || 'bg-white/5 text-white/50 border-white/10'
                  }`}
                >
                  {msg.source}
                </span>
                <ChevronRight size={12} className="text-white/20" />
                {/* Target badge */}
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded border ${
                    sourceBadgeColors[msg.target?.toLowerCase()] || 'bg-white/5 text-white/50 border-white/10'
                  }`}
                >
                  {msg.target}
                </span>
                {/* Type badge */}
                <span
                  className={`text-xs px-2 py-0.5 rounded ml-auto ${
                    typeBadgeColors[msg.type?.toLowerCase()] || 'bg-white/5 text-white/50'
                  }`}
                >
                  {msg.type}
                </span>
              </div>
              <p className="text-sm text-white/80 whitespace-pre-wrap break-words">
                {msg.content}
              </p>
              <div className="flex items-center gap-1 mt-2 text-xs text-white/30">
                <Clock size={11} />
                {msg.created_at ? timeAgo(msg.created_at) : 'just now'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Send Message Form (always visible at bottom when toggled) */}
      {showSendForm && (
        <div className="shrink-0 bg-void-dark border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Send Message</h4>
            <button
              onClick={() => setShowSendForm(false)}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Source</label>
              <select
                value={sendSource}
                onChange={(e) => setSendSource(e.target.value)}
                className="bg-void-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan/50 transition-colors appearance-none cursor-pointer"
              >
                {TARGET_OPTIONS.map((o) => (
                  <option key={o} value={o} className="bg-void-dark">{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Target</label>
              <select
                value={sendTarget}
                onChange={(e) => setSendTarget(e.target.value)}
                className="bg-void-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan/50 transition-colors appearance-none cursor-pointer"
              >
                {TARGET_OPTIONS.map((o) => (
                  <option key={o} value={o} className="bg-void-dark">{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Type</label>
              <select
                value={sendType}
                onChange={(e) => setSendType(e.target.value)}
                className="bg-void-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan/50 transition-colors appearance-none cursor-pointer"
              >
                {TYPE_OPTIONS.filter((t) => t !== 'All').map((t) => (
                  <option key={t} value={t} className="bg-void-dark">{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <textarea
              value={sendContent}
              onChange={(e) => setSendContent(e.target.value)}
              className="flex-1 bg-void-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-neon-cyan/50 transition-colors"
              placeholder="Enter message content..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSend()
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !sendContent.trim()}
              className="self-end flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2 rounded-lg hover:bg-neon-cyan/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

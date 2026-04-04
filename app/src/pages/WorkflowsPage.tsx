import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import {
  RefreshCw,
  ExternalLink,
  Zap,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  GitBranch,
} from 'lucide-react'

interface Workflow {
  id: string | number
  name: string
  active: boolean
  created_at?: string
  updated_at?: string
  tags?: string[]
  nodes?: number
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

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [togglingIds, setTogglingIds] = useState<Set<string | number>>(new Set())
  const [triggeringIds, setTriggeringIds] = useState<Set<string | number>>(new Set())

  const fetchWorkflows = useCallback(async () => {
    setError('')
    try {
      const data = await api.get('/workflows')
      const list = Array.isArray(data) ? data : data?.workflows || []
      setWorkflows(list)
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows. n8n may not be reachable.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchWorkflows()
    setRefreshing(false)
  }

  async function handleToggle(workflow: Workflow) {
    const wfId = workflow.id
    setTogglingIds((prev) => new Set(prev).add(wfId))
    try {
      if (workflow.active) {
        await api.post(`/workflows/deactivate/${wfId}`)
      } else {
        await api.post(`/workflows/activate/${wfId}`)
      }
      setWorkflows((prev) =>
        prev.map((w) => (w.id === wfId ? { ...w, active: !w.active } : w))
      )
    } catch {
      // silently handle
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(wfId)
        return next
      })
    }
  }

  async function handleTrigger(wfId: string | number) {
    setTriggeringIds((prev) => new Set(prev).add(wfId))
    try {
      await api.post(`/workflows/trigger/${wfId}`)
    } catch {
      // silently handle
    } finally {
      setTriggeringIds((prev) => {
        const next = new Set(prev)
        next.delete(wfId)
        return next
      })
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
        <h1 className="text-2xl font-bold text-white">Workflows</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors border border-white/10 rounded-lg px-3 py-2"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <a
            href="http://localhost:5678"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/5 text-white/70 hover:text-white border border-white/10 hover:border-white/20 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <ExternalLink size={14} />
            Open n8n
          </a>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <AlertTriangle size={20} className="text-red-400 shrink-0" />
          <div>
            <p className="text-sm text-red-400 font-medium">n8n is not reachable</p>
            <p className="text-xs text-red-400/60 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Workflow List */}
      {!error && workflows.length === 0 ? (
        <div className="bg-void-gray border border-white/5 rounded-xl p-12 text-center">
          <GitBranch size={48} className="text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No workflows found</p>
          <a
            href="http://localhost:5678"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-4 text-neon-cyan text-sm hover:underline"
          >
            Create one in n8n <ExternalLink size={12} />
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-void-gray border border-white/5 rounded-xl p-6 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-white truncate">{wf.name}</h3>
                  <span className="text-xs text-gray-500">ID: {wf.id}</span>
                </div>
                {/* Active toggle */}
                <button
                  onClick={() => handleToggle(wf)}
                  disabled={togglingIds.has(wf.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                    wf.active ? 'bg-green-500' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      wf.active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-3">
                {wf.active ? (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <Play size={12} /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Pause size={12} /> Inactive
                  </span>
                )}
                {wf.tags && wf.tags.length > 0 && (
                  <div className="flex gap-1">
                    {wf.tags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {wf.created_at && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> Created {timeAgo(wf.created_at)}
                    </span>
                  )}
                  {wf.updated_at && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> Updated {timeAgo(wf.updated_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTrigger(wf.id)}
                    disabled={triggeringIds.has(wf.id)}
                    className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Zap size={12} />
                    {triggeringIds.has(wf.id) ? 'Triggering...' : 'Trigger'}
                  </button>
                  <a
                    href={`http://localhost:5678/workflow/${wf.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs bg-white/5 text-white/50 hover:text-white hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <ExternalLink size={12} />
                    Open
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

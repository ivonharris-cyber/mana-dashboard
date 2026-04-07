import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import {
  Film, Music, Image, Plus, Play, RefreshCw, Send,
  Download, Folder, Zap, MonitorPlay, Share2, Sparkles,
  Clapperboard, Mic, PenTool, Trash2, ChevronRight
} from 'lucide-react'

interface Project {
  id: number; name: string; type: string; status: string
  description: string; tags: string; social_targets: string
  created_at: string; updated_at: string
}

interface PipelineStatus {
  comfyui: { status: string; system?: any }
  brandulate: { status: string; pipeline?: any; system?: any }
  ollama: { status: string; models?: { name: string; size: number }[] }
}

const PROJECT_TYPES = [
  { id: 'video', label: 'Video', icon: Film, color: '#3B82F6' },
  { id: 'music', label: 'Music', icon: Music, color: '#A855F7' },
  { id: 'reel', label: 'Reel', icon: MonitorPlay, color: '#EC4899' },
  { id: 'image', label: 'Image', icon: Image, color: '#22C55E' },
]

const SOCIAL_PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'Facebook', 'Twitter/X', 'Spotify']

export default function StudioPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showScript, setShowScript] = useState(false)
  const [activeProject, setActiveProject] = useState<Project | null>(null)

  // Create form
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('video')
  const [newDesc, setNewDesc] = useState('')
  const [newSocials, setNewSocials] = useState<string[]>([])

  // Script generator
  const [scriptPrompt, setScriptPrompt] = useState('')
  const [scriptType, setScriptType] = useState('video')
  const [scriptResult, setScriptResult] = useState('')
  const [scriptLoading, setScriptLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [projData, pipeData] = await Promise.allSettled([
        api.get('/studio/projects'),
        api.get('/studio/pipeline'),
      ])
      if (projData.status === 'fulfilled') setProjects(projData.value?.projects || [])
      if (pipeData.status === 'fulfilled') setPipeline(pipeData.value)
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleCreate() {
    if (!newName.trim()) return
    await api.post('/studio/projects', {
      name: newName, type: newType, description: newDesc, social_targets: newSocials
    })
    setNewName(''); setNewDesc(''); setNewSocials([]); setShowCreate(false)
    fetchAll()
  }

  async function handleDelete(id: number) {
    await api.delete(`/studio/projects/${id}`)
    fetchAll()
  }

  async function handleGenScript() {
    if (!scriptPrompt.trim()) return
    setScriptLoading(true); setScriptResult('')
    try {
      const data = await api.post('/studio/generate/script', {
        prompt: scriptPrompt, type: scriptType,
        model: scriptType === 'romance' ? 'romance-girlfriend' : 'nous-hermes2'
      })
      setScriptResult(data?.script || 'No response')
    } catch { setScriptResult('Error generating script') }
    finally { setScriptLoading(false) }
  }

  async function handleExportFilmora(project: Project) {
    try {
      const data = await api.post('/studio/export/filmora', { project_id: project.id, scenes: [] })
      const blob = new Blob([data.fcpxml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = data.filename; a.click()
      URL.revokeObjectURL(url)
    } catch { /* */ }
  }

  async function handlePublish(project: Project) {
    try {
      await api.put(`/studio/projects/${project.id}`, { status: 'published' })
      fetchAll()
    } catch { /* */ }
  }

  async function handlePreview(project: Project) {
    setActiveProject(project)
  }

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
          <h1 className="text-2xl font-bold text-white">Production Studio</h1>
          <p className="text-sm text-white/40 mt-1">Music, video, reels — create, generate, publish</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowScript(!showScript)}
            className="flex items-center gap-2 bg-purple-500/20 text-purple-400 font-semibold px-4 py-2.5 rounded-lg hover:bg-purple-500/30 transition-colors text-sm">
            <Sparkles size={16} /> AI Writer
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2.5 rounded-lg hover:bg-neon-cyan/90 transition-colors text-sm">
            <Plus size={16} /> New Project
          </button>
        </div>
      </div>

      {/* Pipeline Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'ComfyUI', status: pipeline?.comfyui?.status, icon: Image, color: '#22C55E',
            detail: pipeline?.comfyui?.status === 'online' ? 'Image Gen Ready' : 'Offline' },
          { label: 'Brandulate', status: pipeline?.brandulate?.status, icon: Film, color: '#3B82F6',
            detail: pipeline?.brandulate?.status === 'online' ? 'Pipeline Active' : 'Offline' },
          { label: 'Ollama', status: pipeline?.ollama?.status, icon: Zap, color: '#F59E0B',
            detail: pipeline?.ollama?.models ? `${pipeline.ollama.models.length} models` : 'Offline' },
          { label: 'Projects', status: 'online', icon: Folder, color: '#A855F7',
            detail: `${projects.length} active` },
        ].map(s => (
          <div key={s.label} className="bg-void-gray border border-white/5 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${s.color}15` }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{s.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${s.status === 'online' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-[11px] text-white/40">{s.detail}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Script Writer */}
      {showScript && (
        <div className="bg-void-gray border border-purple-500/20 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
            <Sparkles size={14} /> AI Script Writer
          </h3>
          <div className="flex gap-2">
            {(['video', 'music', 'reel', 'romance'] as const).map(t => (
              <button key={t} onClick={() => setScriptType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  scriptType === t ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-white/40 hover:text-white/60'
                }`}>{t}</button>
            ))}
          </div>
          <textarea value={scriptPrompt} onChange={e => setScriptPrompt(e.target.value)}
            className="w-full h-24 bg-void-black border border-white/10 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-purple-500/30"
            placeholder="Describe your scene, song concept, or reel idea..." />
          <div className="flex items-center gap-3">
            <button onClick={handleGenScript} disabled={scriptLoading || !scriptPrompt.trim()}
              className="flex items-center gap-2 bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors text-sm disabled:opacity-30">
              {scriptLoading ? <RefreshCw size={14} className="animate-spin" /> : <PenTool size={14} />}
              {scriptLoading ? 'Writing...' : 'Generate'}
            </button>
            <span className="text-[10px] text-white/30">
              Model: {scriptType === 'romance' ? 'romance-girlfriend' : 'nous-hermes2'}
            </span>
          </div>
          {scriptResult && (
            <div className="bg-void-black border border-white/5 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-white/70 whitespace-pre-wrap font-mono">{scriptResult}</pre>
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreate && (
        <div className="bg-void-gray border border-neon-cyan/20 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-neon-cyan flex items-center gap-2">
            <Clapperboard size={14} /> New Production
          </h3>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            className="w-full bg-void-black border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-cyan/30"
            placeholder="Project name" />
          <div className="flex gap-2">
            {PROJECT_TYPES.map(t => (
              <button key={t.id} onClick={() => setNewType(t.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  newType === t.id ? 'ring-1' : 'bg-white/5 text-white/40'
                }`} style={newType === t.id ? { backgroundColor: `${t.color}15`, color: t.color, ringColor: t.color } : {}}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
            className="w-full h-20 bg-void-black border border-white/10 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-neon-cyan/30"
            placeholder="Description..." />
          <div>
            <p className="text-[10px] text-white/30 mb-2">Publish to:</p>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.map(p => (
                <button key={p} onClick={() => setNewSocials(prev =>
                  prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                )} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  newSocials.includes(p) ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/5 text-white/40'
                }`}>{p}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!newName.trim()}
              className="flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-30">
              <Plus size={14} /> Create
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-white/40 hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Productions</h3>
        {projects.length === 0 ? (
          <div className="bg-void-gray border border-white/5 rounded-xl p-12 text-center">
            <Film size={48} className="text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-sm">No productions yet</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 text-neon-cyan text-sm hover:underline">
              Start your first production
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => {
              const typeConfig = PROJECT_TYPES.find(t => t.id === p.type) || PROJECT_TYPES[0]
              const socials = (() => { try { return JSON.parse(p.social_targets || '[]') } catch { return [] } })()
              const statusColors: Record<string, string> = {
                draft: '#6B7280', production: '#F59E0B', rendering: '#3B82F6',
                review: '#A855F7', published: '#22C55E', archived: '#EF4444'
              }
              return (
                <div key={p.id} className="bg-void-gray border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all group relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${typeConfig.color}15` }}>
                        <typeConfig.icon size={18} style={{ color: typeConfig.color }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-neon-cyan transition-colors">{p.name}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                          style={{ backgroundColor: `${statusColors[p.status] || '#6B7280'}15`, color: statusColors[p.status] || '#6B7280' }}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(p.id)}
                      className="text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {p.description && <p className="text-xs text-white/40 mt-3 line-clamp-2">{p.description}</p>}
                  {socials.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {socials.map((s: string) => (
                        <span key={s} className="text-[9px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                    <button onClick={() => handleExportFilmora(p)}
                      className="flex items-center gap-1 text-[10px] text-white/30 hover:text-neon-cyan transition-colors">
                      <Download size={10} /> Filmora
                    </button>
                    <button onClick={() => handlePublish(p)}
                      className="flex items-center gap-1 text-[10px] text-white/30 hover:text-purple-400 transition-colors">
                      <Share2 size={10} /> Publish
                    </button>
                    <button onClick={() => handlePreview(p)}
                      className="flex items-center gap-1 text-[10px] text-white/30 hover:text-green-400 transition-colors ml-auto">
                      <Play size={10} /> Preview
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Active Project Preview */}
      {activeProject && (
        <div className="bg-void-gray border border-green-500/20 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-green-400 flex items-center gap-2">
              <Play size={14} /> Preview: {activeProject.name}
            </h3>
            <button onClick={() => setActiveProject(null)} className="text-white/30 hover:text-white text-xs">Close</button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-white/40">Type:</span> <span className="text-white ml-2">{activeProject.type}</span></div>
            <div><span className="text-white/40">Status:</span> <span className="text-white ml-2">{activeProject.status}</span></div>
            <div className="col-span-2"><span className="text-white/40">Description:</span> <span className="text-white/70 ml-2">{activeProject.description || 'No description'}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { handlePublish(activeProject); setActiveProject(null) }}
              className="flex items-center gap-2 bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-500/30">
              <Share2 size={12} /> Publish Now
            </button>
            <button onClick={() => handleExportFilmora(activeProject)}
              className="flex items-center gap-2 bg-white/5 text-white/40 px-3 py-1.5 rounded-lg text-xs font-medium hover:text-white">
              <Download size={12} /> Export Filmora
            </button>
          </div>
        </div>
      )}

      {/* Video Subagent Orchestrator */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Subagent Pipeline</h3>
        <div className="bg-void-gray border border-white/5 rounded-xl p-5">
          <p className="text-xs text-white/40 mb-4">Agents collaborate to create personalized video content. Each agent handles a stage of the pipeline.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { agent: 'Tina', role: 'Script Writer', desc: 'Writes scripts and dialogue', color: '#EC4899', step: 1 },
              { agent: 'Creative', role: 'Visual Director', desc: 'Generates images via ComfyUI', color: '#A855F7', step: 2 },
              { agent: 'Delivery', role: 'Render Pipeline', desc: 'Assembles & renders video', color: '#10B981', step: 3 },
              { agent: 'Lozgic', role: 'Strategy & Publish', desc: 'Optimizes for platforms', color: '#3B82F6', step: 4 },
            ].map(s => (
              <div key={s.agent} className="bg-void-black border border-white/5 rounded-lg p-4 relative">
                <div className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                  Step {s.step}
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2"
                  style={{ backgroundColor: `${s.color}20`, color: s.color }}>
                  {s.agent[0]}
                </div>
                <p className="text-sm font-medium text-white">{s.agent}</p>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: s.color }}>{s.role}</p>
                <p className="text-[10px] text-white/30 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-neon-cyan/90">
              <Zap size={14} /> Launch Pipeline
            </button>
            <span className="text-[10px] text-white/30">Creates a project and assigns subagents automatically</span>
          </div>
        </div>
      </div>

      {/* Ollama Models */}
      {pipeline?.ollama?.models && pipeline.ollama.models.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">AI Models Available</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {pipeline.ollama.models.map(m => (
              <div key={m.name} className="bg-void-gray border border-white/5 rounded-lg p-3">
                <p className="text-xs font-medium text-white truncate">{m.name}</p>
                <p className="text-[10px] text-white/30">{(m.size / 1e9).toFixed(1)}GB</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

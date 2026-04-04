import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import {
  Cpu, HardDrive, RefreshCw, Server,
  Smartphone, Monitor, Thermometer, Zap, FolderOpen,
  ArrowRightLeft, ChevronDown, ChevronRight, CircuitBoard
} from 'lucide-react'

interface GpuInfo {
  name: string; vram_total_mb: number; vram_used_mb: number
  vram_free_mb: number; temp_c: number; utilization_pct: number
  power_w?: number; power_limit_w?: number
}

interface DiskInfo { total: number; used: number; free: number }

interface NodeInfo {
  id: string; name: string; host: string | null; type: string; status: string
  cpu: number | null; ram: { total: number; used: number } | null
  disk: Record<string, DiskInfo> | null; gpu_info: GpuInfo | null
  docker: string[]
}

interface VramData {
  available: boolean
  gpu?: GpuInfo & { power_w: number; power_limit_w: number }
  processes?: { pid: number; name: string; vram_mb: number }[]
}

interface LargeFile {
  name: string; path: string; dir?: string; size_bytes: number; size_gb: number
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

function UsageBar({ used, total, color, label, height = 'h-3' }: {
  used: number; total: number; color: string; label?: string; height?: string
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const danger = pct > 85
  return (
    <div>
      {label && (
        <div className="flex justify-between text-[10px] text-white/40 mb-1">
          <span>{label}</span>
          <span className={danger ? 'text-red-400 font-bold' : ''}>{formatBytes(used)} / {formatBytes(total)} ({pct}%)</span>
        </div>
      )}
      <div className={`${height} bg-white/5 rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full transition-all duration-700`}
          style={{ width: `${pct}%`, background: danger ? 'linear-gradient(90deg, #EF4444, #DC2626)' : `linear-gradient(90deg, ${color}80, ${color})` }} />
      </div>
    </div>
  )
}

export default function SystemPage() {
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [vram, setVram] = useState<VramData | null>(null)
  const [files, setFiles] = useState<LargeFile[]>([])
  const [filesDrive, setFilesDrive] = useState('D')
  const [filesPath, setFilesPath] = useState('\\AI\\models')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedNode, setExpandedNode] = useState<string | null>('local')

  const fetchAll = useCallback(async () => {
    try {
      const [nodesData, vramData, storageData] = await Promise.allSettled([
        api.get('/system/overview'),
        api.get('/system/vram'),
        api.get(`/system/storage?drive=${filesDrive}&path=${encodeURIComponent(filesPath)}`),
      ])
      if (nodesData.status === 'fulfilled') setNodes(nodesData.value?.nodes || [])
      if (vramData.status === 'fulfilled') setVram(vramData.value)
      if (storageData.status === 'fulfilled') setFiles(storageData.value?.files || [])
    } catch { /* */ } finally { setLoading(false); setRefreshing(false) }
  }, [filesDrive, filesPath])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { const iv = setInterval(fetchAll, 15000); return () => clearInterval(iv) }, [fetchAll])

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 text-neon-cyan animate-spin" /></div>

  const localNode = nodes.find(n => n.id === 'local')
  const vramPct = vram?.gpu ? Math.round((vram.gpu.vram_used_mb / vram.gpu.vram_total_mb) * 100) : 0

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Manager</h1>
          <p className="text-sm text-white/40">VRAM, storage, nodes — monitor and manage</p>
        </div>
        <button onClick={() => { setRefreshing(true); fetchAll() }}
          className="flex items-center gap-2 text-xs text-white/40 hover:text-white">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* VRAM Card (hero) */}
      {vram?.available && vram.gpu && (
        <div className="bg-void-gray border border-green-500/20 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ background: 'radial-gradient(ellipse at 30% 50%, #22C55E, transparent 70%)' }} />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-500/10"><CircuitBoard size={20} className="text-green-400" /></div>
            <div>
              <h3 className="text-sm font-bold text-white">{vram.gpu.name}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1 text-[11px] text-white/40">
                  <Thermometer size={10} /> {vram.gpu.temp_c}C
                </span>
                <span className="flex items-center gap-1 text-[11px] text-white/40">
                  <Zap size={10} /> {vram.gpu.power_w?.toFixed(0)}W / {vram.gpu.power_limit_w?.toFixed(0)}W
                </span>
                <span className="text-[11px] text-white/40">
                  GPU: {vram.gpu.utilization_pct}%
                </span>
              </div>
            </div>
            <div className="ml-auto text-right">
              <span className="text-3xl font-bold text-green-400">{vram.gpu.vram_free_mb}</span>
              <span className="text-sm text-white/30 ml-1">MB free</span>
            </div>
          </div>
          <UsageBar used={vram.gpu.vram_used_mb * 1e6} total={vram.gpu.vram_total_mb * 1e6} color="#22C55E" label={`VRAM — ${vram.gpu.vram_used_mb}MB / ${vram.gpu.vram_total_mb}MB (${vramPct}%)`} height="h-4" />

          {/* GPU Processes */}
          {vram.processes && vram.processes.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">GPU Processes</p>
              {vram.processes.map(p => (
                <div key={p.pid} className="flex items-center justify-between bg-void-black/50 rounded px-3 py-1.5">
                  <span className="text-xs text-white/60 font-mono">{p.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-green-400 font-bold">{p.vram_mb} MB</span>
                    <span className="text-[10px] text-white/20">PID {p.pid}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Node Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Nodes</h3>
        {nodes.map(node => {
          const expanded = expandedNode === node.id
          const icons: Record<string, typeof Server> = { local: Monitor, vps: Server, mobile: Smartphone }
          const Icon = icons[node.type] || Server
          const colors: Record<string, string> = { online: '#22C55E', offline: '#EF4444', tailscale: '#3B82F6' }

          return (
            <div key={node.id} className="bg-void-gray border border-white/5 rounded-xl overflow-hidden">
              <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02]"
                onClick={() => setExpandedNode(expanded ? null : node.id)}>
                <div className="p-2 rounded-lg bg-white/5"><Icon size={18} className="text-white/50" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{node.name}</h4>
                    <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: colors[node.status] || '#6B7280' }} />
                    <span className="text-[10px] text-white/30">{node.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {node.host && <span className="text-[10px] text-white/20 font-mono">{node.host}</span>}
                    {node.cpu && <span className="text-[10px] text-white/30">{node.cpu} CPU</span>}
                    {node.ram && <span className="text-[10px] text-white/30">{formatBytes(node.ram.total)} RAM</span>}
                    {node.gpu_info && <span className="text-[10px] text-green-400">{node.gpu_info.name}</span>}
                    {node.docker?.length > 0 && <span className="text-[10px] text-purple-400">{node.docker.length} containers</span>}
                  </div>
                </div>
                {expanded ? <ChevronDown size={16} className="text-white/30" /> : <ChevronRight size={16} className="text-white/30" />}
              </div>

              {expanded && node.status !== 'offline' && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                  {/* RAM */}
                  {node.ram && (
                    <UsageBar used={node.ram.used} total={node.ram.total} color="#3B82F6" label="RAM" />
                  )}
                  {/* Disks */}
                  {node.disk && Object.entries(node.disk).map(([name, d]) => (
                    <UsageBar key={name} used={d.used} total={d.total} color="#F59E0B" label={`Disk ${name.toUpperCase()}`} />
                  ))}
                  {/* GPU */}
                  {node.gpu_info && (
                    <UsageBar used={node.gpu_info.vram_used_mb * 1e6} total={node.gpu_info.vram_total_mb * 1e6} color="#22C55E"
                      label={`VRAM (${node.gpu_info.name})`} />
                  )}
                  {/* Docker containers */}
                  {node.docker && node.docker.length > 0 && (
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Docker</p>
                      <div className="flex flex-wrap gap-1">
                        {node.docker.map(c => (
                          <span key={c} className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Large Files / NVME Storage */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <HardDrive size={14} /> Large Files
          </h3>
          <div className="flex items-center gap-2">
            <select value={filesDrive} onChange={e => setFilesDrive(e.target.value)}
              className="bg-void-black border border-white/10 rounded px-2 py-1 text-xs text-white appearance-none">
              <option value="C">C:</option>
              <option value="D">D:</option>
            </select>
            <input value={filesPath} onChange={e => setFilesPath(e.target.value)}
              className="bg-void-black border border-white/10 rounded px-2 py-1 text-xs text-white w-40"
              placeholder="\AI\models" />
            <button onClick={() => fetchAll()} className="text-xs text-neon-cyan hover:underline">Scan</button>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="bg-void-gray border border-white/5 rounded-xl p-8 text-center">
            <FolderOpen size={32} className="text-white/10 mx-auto mb-2" />
            <p className="text-sm text-white/30">No large files found (100MB+)</p>
          </div>
        ) : (
          <div className="bg-void-gray border border-white/5 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_100px_40px] gap-2 px-4 py-2 text-[10px] text-white/30 uppercase tracking-wider border-b border-white/5">
              <span>File</span><span className="text-right">Size</span><span>Location</span><span></span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_100px_40px] gap-2 px-4 py-2 text-xs hover:bg-white/[0.02] items-center border-b border-white/[0.02]">
                  <span className="text-white/70 truncate font-mono" title={f.path}>{f.name}</span>
                  <span className="text-right text-amber-400 font-bold">{f.size_gb} GB</span>
                  <span className="text-white/20 truncate text-[10px]" title={f.dir}>{f.dir?.split('/').slice(-2).join('/')}</span>
                  <button className="text-white/10 hover:text-neon-cyan" title="Transfer"><ArrowRightLeft size={12} /></button>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-white/5 text-[10px] text-white/30">
              {files.length} files &middot; {files.reduce((sum, f) => sum + f.size_gb, 0).toFixed(1)} GB total
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

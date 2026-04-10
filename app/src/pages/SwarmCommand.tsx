import { useState, useEffect } from 'react';

interface NodeInfo {
  name: string; ip: string; tailscale_ip: string; os: string; status: string;
  cpu_percent: number; memory_used_mb: number; memory_total_mb: number;
  disk_used_gb: number; disk_total_gb: number; containers_running: number;
  containers_total: number; uptime_hours: number; gpu?: string;
}
interface Service { name: string; node: string; port: number | null; status: string; detail: string; }
interface TailscaleNode { name: string; ip: string; os: string; online: boolean; }
interface Activity { bot: string; action: string; time: string; node: string; status: string; }
interface SecurityInfo { firewall: string; fail2ban: string; last_scan: string; threats_blocked_24h: number; ssl_certs_valid: number; wordfence_stores: number; }
interface SwarmData {
  nodes: NodeInfo[]; active_bots: number; total_bots: number; total_services: number;
  active_workflows: number; services: Service[]; tailscale_mesh: TailscaleNode[];
  recent_activity: Activity[]; security: SecurityInfo;
}

const BOT_COLORS: Record<string, string> = {
  Shield: '#ef4444', Grok: '#a855f7', Hera: '#ec4899', Builder: '#f97316',
  Ops: '#eab308', Aroha: '#14b8a6', Cat62: '#06b6d4', 'ComfyUI Artist': '#8b5cf6',
  'AI Dev': '#3b82f6', Secretary: '#f472b6', 'Dev Engineer': '#22c55e',
  'Media Listener': '#64748b', 'AutoBot SecTeam': '#dc2626', Cyborg: '#6366f1', Phoenix: '#f59e0b'
};

function ProgressBar({ value, max, color = 'emerald' }: { value: number; max: number; color?: string }) {
  const pct = Math.round((value / max) * 100);
  const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : `bg-${color}-500`;
  return (
    <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function SwarmCommand() {
  const [data, setData] = useState<SwarmData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/swarm/status');
        if (res.ok) setData(await res.json());
      } catch {}
    };
    fetchData();
    const interval = setInterval(() => { fetchData(); setTick(t => t + 1); }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <div className="flex items-center justify-center h-screen bg-gray-950 text-emerald-400 text-xl">Loading Swarm...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 space-y-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 tracking-wider">SWARM COMMAND</h1>
          <p className="text-xs text-gray-500 font-mono">ManaMetaMaori Operations Center</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
          <span className="text-xs text-emerald-400 font-mono">LIVE</span>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Bots" value={data.active_bots} subtext={`/ ${data.total_bots} total`} pulse />
        <StatCard label="Services" value={data.total_services} subtext="across 3 nodes" />
        <StatCard label="Workflows" value={data.active_workflows} subtext="n8n active" />
        <StatCard label="Threats Blocked" value={data.security.threats_blocked_24h} subtext="last 24h" color="red" />
      </div>

      {/* Nodes + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Node Cards */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Infrastructure Nodes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.nodes.map(node => (
              <div key={node.name} className="bg-gray-900/80 border border-gray-800 rounded-lg p-4 hover:border-emerald-700/50 transition-all hover:shadow-lg hover:shadow-emerald-900/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-emerald-300">{node.name}</h3>
                  <span className={`w-2.5 h-2.5 rounded-full ${node.status === 'online' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-red-500'}`} />
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-gray-400 mb-0.5"><span>CPU</span><span>{node.cpu_percent}%</span></div>
                    <ProgressBar value={node.cpu_percent} max={100} />
                  </div>
                  <div>
                    <div className="flex justify-between text-gray-400 mb-0.5"><span>RAM</span><span>{(node.memory_used_mb/1024).toFixed(1)}G / {(node.memory_total_mb/1024).toFixed(0)}G</span></div>
                    <ProgressBar value={node.memory_used_mb} max={node.memory_total_mb} />
                  </div>
                  <div>
                    <div className="flex justify-between text-gray-400 mb-0.5"><span>Disk</span><span>{node.disk_used_gb}G / {node.disk_total_gb}G</span></div>
                    <ProgressBar value={node.disk_used_gb} max={node.disk_total_gb} />
                  </div>
                  <div className="flex justify-between text-gray-500 pt-1 border-t border-gray-800">
                    <span>Containers</span>
                    <span className="text-emerald-400">{node.containers_running}/{node.containers_total}</span>
                  </div>
                  {node.gpu && <div className="flex justify-between text-gray-500"><span>GPU</span><span className="text-purple-400">{node.gpu}</span></div>}
                  <div className="text-gray-600 font-mono text-[10px]">{node.tailscale_ip}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Services Grid */}
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mt-4">Services ({data.services.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {data.services.map((svc, i) => (
              <div key={`${svc.name}-${i}`} className="bg-gray-900/60 border border-gray-800/50 rounded-md p-2.5 hover:border-emerald-800/50 transition-all text-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${svc.status === 'healthy' ? 'bg-emerald-500' : svc.status === 'idle' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <span className="font-medium text-gray-200 truncate">{svc.name}</span>
                </div>
                <div className="text-gray-500 text-[10px] truncate">{svc.node}</div>
                <div className="text-emerald-600 text-[10px] font-mono">{svc.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Activity Feed + Mesh + Security */}
        <div className="space-y-3">
          {/* Bot Activity Feed */}
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Bot Activity</h2>
          <div className="bg-gray-900/90 border border-gray-800 rounded-lg p-3 max-h-[340px] overflow-y-auto scrollbar-thin">
            <div className="space-y-1.5 font-mono text-xs">
              {data.recent_activity.map((a, i) => (
                <div key={`${i}-${tick}`} className={`flex gap-2 py-1 border-b border-gray-800/50 ${i === 0 ? 'animate-pulse' : ''}`}>
                  <span className="text-gray-600 w-14 flex-shrink-0 text-right">{a.time}</span>
                  <span className="font-bold flex-shrink-0" style={{ color: BOT_COLORS[a.bot] || '#9ca3af', minWidth: '5rem' }}>{a.bot}</span>
                  <span className="text-gray-400 truncate">{a.action}</span>
                  <span className={`ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${a.status === 'success' ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Tailscale Mesh */}
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tailscale Mesh</h2>
          <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-3 space-y-2">
            {data.tailscale_mesh.map(node => (
              <div key={node.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${node.online ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                  <span className={node.online ? 'text-gray-200' : 'text-gray-600'}>{node.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-mono text-[10px]">{node.ip}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${node.os === 'linux' ? 'bg-emerald-900/50 text-emerald-400' : node.os === 'windows' ? 'bg-blue-900/50 text-blue-400' : 'bg-orange-900/50 text-orange-400'}`}>{node.os}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Security Status */}
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Security</h2>
          <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-gray-400">Firewall</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-gray-400">fail2ban</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-gray-400">SSL ({data.security.ssl_certs_valid})</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-gray-400">Wordfence ({data.security.wordfence_stores})</span></div>
            <div className="col-span-2 text-gray-500 pt-1 border-t border-gray-800">Last scan: {data.security.last_scan}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, pulse, color = 'emerald' }: { label: string; value: number; subtext: string; pulse?: boolean; color?: string }) {
  const colorMap: Record<string, string> = { emerald: 'text-emerald-400 border-emerald-900/50', red: 'text-red-400 border-red-900/50', yellow: 'text-yellow-400 border-yellow-900/50' };
  const c = colorMap[color] || colorMap.emerald;
  return (
    <div className={`bg-gray-900/80 border rounded-lg p-3 ${c.split(' ')[1]}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold ${c.split(' ')[0]} ${pulse ? 'animate-pulse' : ''}`}>{value}</span>
        <span className="text-xs text-gray-500 mb-1">{subtext}</span>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'

// ── Island locations ──────────────────────────────────────────────
const LOCATIONS = [
  { id: 'marae', name: 'Te Marae', x: 400, y: 120, w: 140, h: 90, color: '#8B5CF6', emoji: '🏛️', desc: 'Sacred meeting ground' },
  { id: 'server-room', name: 'Server Room', x: 80, y: 280, w: 120, h: 80, color: '#06B6D4', emoji: '🖥️', desc: 'The digital heart' },
  { id: 'beach', name: 'Te Moana', x: 650, y: 380, w: 160, h: 70, color: '#0EA5E9', emoji: '🌊', desc: 'Ocean shore' },
  { id: 'garden', name: 'Māra Kai', x: 200, y: 430, w: 130, h: 80, color: '#22C55E', emoji: '🌿', desc: 'Community garden' },
  { id: 'radio', name: 'Kia Ora FM', x: 550, y: 130, w: 120, h: 70, color: '#F59E0B', emoji: '📻', desc: 'Radio station' },
  { id: 'workshop', name: 'Workshop', x: 100, y: 100, w: 110, h: 70, color: '#F97316', emoji: '🔧', desc: 'Build & create' },
  { id: 'lookout', name: 'Tihi', x: 680, y: 60, w: 100, h: 60, color: '#DC2626', emoji: '👁️', desc: 'Watchpoint hilltop' },
  { id: 'campfire', name: 'Ahi Kā', x: 380, y: 300, w: 100, h: 80, color: '#EC4899', emoji: '🔥', desc: 'Gathering fire' },
]

// ── Agent personality traits for autonomous behavior ──────────────
const PERSONALITY: Record<string, { haunts: string[]; mood: string; chatStyle: string }> = {
  tina: { haunts: ['radio', 'campfire', 'beach'], mood: 'bubbly', chatStyle: 'OMG have you seen the latest trends?!' },
  lozgic: { haunts: ['marae', 'server-room', 'lookout'], mood: 'strategic', chatStyle: 'According to my analysis...' },
  forge: { haunts: ['workshop', 'server-room'], mood: 'focused', chatStyle: 'Let me build something for that.' },
  security: { haunts: ['lookout', 'server-room', 'marae'], mood: 'vigilant', chatStyle: 'I detected something unusual...' },
  hapai: { haunts: ['marae', 'garden', 'campfire'], mood: 'caring', chatStyle: 'How is everyone doing today?' },
  creative: { haunts: ['beach', 'garden', 'campfire'], mood: 'dreamy', chatStyle: 'What if we tried something wild...' },
  main: { haunts: ['marae', 'campfire', 'server-room'], mood: 'balanced', chatStyle: 'Let me coordinate this.' },
  netwatch: { haunts: ['server-room', 'lookout'], mood: 'alert', chatStyle: 'Network status: all clear.' },
  'gateway-vps': { haunts: ['server-room', 'lookout', 'radio'], mood: 'busy', chatStyle: 'Routing traffic through the mesh...' },
  'cat62-keeper': { haunts: ['workshop', 'server-room'], mood: 'quiet', chatStyle: 'cat62 node is humming along.' },
  'relay-mesh': { haunts: ['campfire', 'server-room', 'radio'], mood: 'social', chatStyle: 'Passing that message along!' },
  sentinel: { haunts: ['lookout', 'marae', 'server-room'], mood: 'stern', chatStyle: 'Perimeter secure.' },
  'kali-commander': { haunts: ['server-room', 'lookout', 'workshop'], mood: 'tactical', chatStyle: 'Tunnel established. All systems go.' },
  'seo-scraper': { haunts: ['radio', 'workshop', 'campfire'], mood: 'hungry', chatStyle: 'Found some juicy data...' },
}

const CHAT_LINES = [
  (a: string) => `${a}: Kia ora, everyone!`,
  (a: string) => `${a}: Beautiful day on the island.`,
  (a: string, b: string) => `${a} → ${b}: Hey, wanna collab?`,
  (a: string) => `${a}: *stretches* Time for a walk.`,
  (a: string, b: string) => `${a} → ${b}: What are you working on?`,
  (a: string) => `${a}: I've got an idea...`,
  (a: string) => `${a}: Checking the systems real quick.`,
  (a: string, b: string) => `${a} → ${b}: Come check this out!`,
  (a: string) => `${a}: *vibing*`,
  (a: string) => `${a}: Aroha mai, just thinking out loud.`,
  (a: string, b: string) => `${a} → ${b}: Race you to the beach!`,
  (a: string) => `${a}: The sunset from Tihi is amazing.`,
]

interface Agent {
  id: string
  display_name: string
  color: string
  model: string
  role_desc?: string
}

interface SimAgent {
  id: string
  name: string
  color: string
  x: number
  y: number
  targetX: number
  targetY: number
  location: string
  emoji: string
  bubble: string | null
  bubbleTimer: number
  model: string
  role: string
}

interface ChatEntry {
  time: string
  text: string
  color: string
}

export default function IslandPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [agents, setAgents] = useState<SimAgent[]>([])
  const [chatLog, setChatLog] = useState<ChatEntry[]>([])
  const [dayTime, setDayTime] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning')
  const [tick, setTick] = useState(0)
  const [paused, setPaused] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<SimAgent | null>(null)
  const [speed, setSpeed] = useState(1)
  const agentsRef = useRef<SimAgent[]>([])
  const chatRef = useRef<HTMLDivElement>(null)

  // Fetch agents from API and initialize sim
  useEffect(() => {
    api.get('/agents').then((data: Agent[]) => {
      const simAgents: SimAgent[] = data.map((a) => {
        const personality = PERSONALITY[a.id] || { haunts: ['campfire'], mood: 'chill', chatStyle: 'Hey.' }
        const startLoc = LOCATIONS.find((l) => l.id === personality.haunts[0]) || LOCATIONS[0]
        const jitterX = (Math.random() - 0.5) * 60
        const jitterY = (Math.random() - 0.5) * 40
        return {
          id: a.id,
          name: a.display_name,
          color: a.color,
          x: startLoc.x + startLoc.w / 2 + jitterX,
          y: startLoc.y + startLoc.h / 2 + jitterY,
          targetX: startLoc.x + startLoc.w / 2,
          targetY: startLoc.y + startLoc.h / 2,
          location: startLoc.id,
          emoji: getAgentEmoji(a.id),
          bubble: null,
          bubbleTimer: 0,
          model: a.model,
          role: a.role_desc || '',
        }
      })
      setAgents(simAgents)
      agentsRef.current = simAgents
    })
  }, [])

  // Day/night cycle (every 30s of sim time)
  useEffect(() => {
    const phases: typeof dayTime[] = ['morning', 'afternoon', 'evening', 'night']
    const idx = Math.floor((tick / 300) % 4)
    setDayTime(phases[idx])
  }, [tick])

  // Main simulation loop
  useEffect(() => {
    if (paused || agents.length === 0) return
    const interval = setInterval(() => {
      setTick((t) => t + 1)
      setAgents((prev) => {
        const updated = prev.map((agent) => {
          let { x, y, targetX, targetY, bubble, bubbleTimer, location } = agent

          // Move toward target
          const dx = targetX - x
          const dy = targetY - y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 2) {
            x += (dx / dist) * (1.5 * speed)
            y += (dy / dist) * (1.5 * speed)
          }

          // Bubble countdown
          if (bubbleTimer > 0) {
            bubbleTimer -= 1
            if (bubbleTimer <= 0) bubble = null
          }

          // Random chance to pick new destination
          if (dist < 5 && Math.random() < 0.008 * speed) {
            const personality = PERSONALITY[agent.id]
            const possibleLocs = personality
              ? [...personality.haunts, ...LOCATIONS.map((l) => l.id).filter(() => Math.random() < 0.15)]
              : LOCATIONS.map((l) => l.id)
            const nextLocId = possibleLocs[Math.floor(Math.random() * possibleLocs.length)]
            const nextLoc = LOCATIONS.find((l) => l.id === nextLocId) || LOCATIONS[0]
            targetX = nextLoc.x + nextLoc.w / 2 + (Math.random() - 0.5) * 50
            targetY = nextLoc.y + nextLoc.h / 2 + (Math.random() - 0.5) * 30
            location = nextLoc.id
          }

          return { ...agent, x, y, targetX, targetY, bubble, bubbleTimer, location }
        })

        // Random chat between nearby agents
        if (Math.random() < 0.02 * speed) {
          const i = Math.floor(Math.random() * updated.length)
          const a = updated[i]
          // Find someone nearby
          const nearby = updated.filter(
            (b) => b.id !== a.id && Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) < 80
          )
          if (nearby.length > 0) {
            const b = nearby[Math.floor(Math.random() * nearby.length)]
            const lineFn = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]
            const text = lineFn(a.name, b.name)
            updated[i] = { ...a, bubble: text.split(': ').slice(1).join(': ') || text, bubbleTimer: 80 }
            const now = new Date()
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
            setChatLog((prev) => [...prev.slice(-80), { time: timeStr, text, color: a.color }])
          } else {
            // Solo chat
            const personality = PERSONALITY[a.id]
            if (personality && Math.random() < 0.5) {
              const soloText = `${a.name}: ${personality.chatStyle}`
              updated[i] = { ...a, bubble: personality.chatStyle, bubbleTimer: 80 }
              const now = new Date()
              const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
              setChatLog((prev) => [...prev.slice(-80), { time: timeStr, text: soloText, color: a.color }])
            }
          }
        }

        agentsRef.current = updated
        return updated
      })
    }, 50)
    return () => clearInterval(interval)
  }, [paused, agents.length, speed])

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [chatLog])

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const W = canvas.width
      const H = canvas.height

      // Sky gradient based on time of day
      const skyColors: Record<string, [string, string]> = {
        morning: ['#0c1222', '#1a2744'],
        afternoon: ['#0a0f1e', '#162040'],
        evening: ['#0d0818', '#1a0e2e'],
        night: ['#020208', '#080814'],
      }
      const [c1, c2] = skyColors[dayTime]
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H)
      skyGrad.addColorStop(0, c1)
      skyGrad.addColorStop(1, c2)
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, W, H)

      // Stars at night
      if (dayTime === 'night') {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        for (let i = 0; i < 60; i++) {
          const sx = ((i * 137.5) % W)
          const sy = ((i * 97.3) % (H * 0.6))
          ctx.beginPath()
          ctx.arc(sx, sy, Math.random() > 0.9 ? 1.5 : 0.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Water edge
      ctx.fillStyle = 'rgba(14, 165, 233, 0.08)'
      ctx.beginPath()
      ctx.ellipse(W - 40, H - 20, 200, 80, 0, 0, Math.PI * 2)
      ctx.fill()

      // Ground / island shape
      ctx.fillStyle = 'rgba(34, 197, 94, 0.04)'
      ctx.beginPath()
      ctx.ellipse(W / 2, H / 2 + 40, W / 2 - 20, H / 2 - 30, 0, 0, Math.PI * 2)
      ctx.fill()

      // Grid lines (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.02)'
      ctx.lineWidth = 1
      for (let gx = 0; gx < W; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
      }
      for (let gy = 0; gy < H; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
      }

      // Draw locations
      LOCATIONS.forEach((loc) => {
        // Building shape
        ctx.fillStyle = loc.color + '18'
        ctx.strokeStyle = loc.color + '40'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(loc.x, loc.y, loc.w, loc.h, 8)
        ctx.fill()
        ctx.stroke()

        // Glow
        ctx.shadowColor = loc.color
        ctx.shadowBlur = 10
        ctx.strokeStyle = loc.color + '30'
        ctx.stroke()
        ctx.shadowBlur = 0

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '11px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(loc.emoji + ' ' + loc.name, loc.x + loc.w / 2, loc.y - 6)
      })

      // Draw agents
      const currentAgents = agentsRef.current
      currentAgents.forEach((agent) => {
        const ax = agent.x
        const ay = agent.y

        // Glow circle
        ctx.beginPath()
        ctx.arc(ax, ay, 18, 0, Math.PI * 2)
        ctx.fillStyle = agent.color + '25'
        ctx.fill()
        ctx.strokeStyle = agent.color + '80'
        ctx.lineWidth = 2
        ctx.stroke()

        // Inner circle
        ctx.beginPath()
        ctx.arc(ax, ay, 10, 0, Math.PI * 2)
        ctx.fillStyle = agent.color
        ctx.fill()

        // Emoji
        ctx.font = '14px serif'
        ctx.textAlign = 'center'
        ctx.fillText(agent.emoji, ax, ay + 5)

        // Name tag
        ctx.font = 'bold 10px Inter, sans-serif'
        ctx.fillStyle = agent.color
        ctx.textAlign = 'center'
        ctx.fillText(agent.name, ax, ay + 28)

        // Speech bubble
        if (agent.bubble) {
          const bubbleText = agent.bubble.length > 35 ? agent.bubble.slice(0, 32) + '...' : agent.bubble
          const bw = ctx.measureText(bubbleText).width + 16
          const bx = ax - bw / 2
          const by = ay - 48

          // Bubble bg
          ctx.fillStyle = 'rgba(10, 10, 15, 0.9)'
          ctx.strokeStyle = agent.color + '60'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.roundRect(bx, by, bw, 22, 6)
          ctx.fill()
          ctx.stroke()

          // Tail
          ctx.fillStyle = 'rgba(10, 10, 15, 0.9)'
          ctx.beginPath()
          ctx.moveTo(ax - 4, by + 22)
          ctx.lineTo(ax + 4, by + 22)
          ctx.lineTo(ax, by + 28)
          ctx.fill()

          // Text
          ctx.font = '10px Inter, sans-serif'
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.textAlign = 'center'
          ctx.fillText(bubbleText, ax, by + 15)
        }
      })

      // Day indicator
      const dayEmoji = { morning: '🌅', afternoon: '☀️', evening: '🌇', night: '🌙' }[dayTime]
      ctx.font = '14px Inter, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.textAlign = 'left'
      ctx.fillText(`${dayEmoji} ${dayTime.charAt(0).toUpperCase() + dayTime.slice(1)}`, 12, 22)
    }

    const animFrame = requestAnimationFrame(function loop() {
      draw()
      requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(animFrame)
  }, [dayTime])

  // Handle canvas click to select agent
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const found = agentsRef.current.find(
        (a) => Math.sqrt((a.x - mx) ** 2 + (a.y - my) ** 2) < 20
      )
      setSelectedAgent(found || null)
    },
    []
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Mana Island <span className="text-neon-cyan">🏝️</span>
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {agents.length} agents living on the island — watch them roam, meet, and chat
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
            className="px-3 py-1.5 text-xs font-mono rounded-lg bg-white/5 text-neon-cyan border border-white/10 hover:bg-white/10"
          >
            {speed}x
          </button>
          <button
            onClick={() => setPaused(!paused)}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg border ${
              paused
                ? 'bg-agent-green/20 text-agent-green border-agent-green/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
          >
            {paused ? '▶ Play' : '⏸ Pause'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Canvas */}
        <div className="flex-1 rounded-xl border border-white/10 overflow-hidden bg-void-dark">
          <canvas
            ref={canvasRef}
            width={840}
            height={520}
            onClick={handleCanvasClick}
            className="w-full cursor-crosshair"
            style={{ imageRendering: 'auto' }}
          />
        </div>

        {/* Sidebar: chat log + selected agent */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {/* Selected agent card */}
          {selectedAgent && (
            <div
              className="rounded-xl border p-4 space-y-2"
              style={{ borderColor: selectedAgent.color + '40', background: selectedAgent.color + '08' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ background: selectedAgent.color + '30' }}
                >
                  {selectedAgent.emoji}
                </div>
                <div>
                  <h3 className="font-bold text-white">{selectedAgent.name}</h3>
                  <p className="text-xs text-white/40">{selectedAgent.model}</p>
                </div>
              </div>
              <p className="text-xs text-white/60">{selectedAgent.role}</p>
              <div className="flex items-center gap-2 text-xs text-white/40">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: selectedAgent.color }}
                />
                {LOCATIONS.find((l) => l.id === selectedAgent.location)?.name || 'Wandering'}
              </div>
              <p className="text-xs italic text-white/30">
                Mood: {PERSONALITY[selectedAgent.id]?.mood || 'chill'}
              </p>
            </div>
          )}

          {/* Chat log */}
          <div className="flex-1 min-h-0 rounded-xl border border-white/10 bg-void-dark flex flex-col">
            <div className="px-3 py-2 border-b border-white/5 text-xs font-bold text-white/60">
              Island Chat
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-1 max-h-[360px]">
              {chatLog.length === 0 && (
                <p className="text-xs text-white/20 italic">Waiting for agents to chat...</p>
              )}
              {chatLog.map((entry, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="text-white/20 font-mono shrink-0">{entry.time}</span>
                  <span style={{ color: entry.color + 'cc' }}>{entry.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Location legend */}
          <div className="rounded-xl border border-white/10 bg-void-dark p-3">
            <div className="text-xs font-bold text-white/60 mb-2">Locations</div>
            <div className="grid grid-cols-2 gap-1">
              {LOCATIONS.map((loc) => (
                <div key={loc.id} className="flex items-center gap-1.5 text-xs text-white/40">
                  <span>{loc.emoji}</span>
                  <span>{loc.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getAgentEmoji(id: string): string {
  const map: Record<string, string> = {
    tina: '💃',
    lozgic: '🧠',
    forge: '⚒️',
    security: '🛡️',
    hapai: '💚',
    creative: '🎨',
    main: '⚡',
    netwatch: '📡',
    'gateway-vps': '🌐',
    'cat62-keeper': '🐱',
    'relay-mesh': '🔗',
    sentinel: '👁️',
    'kali-commander': '🐉',
    'seo-scraper': '🕷️',
  }
  return map[id] || '🤖'
}

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
  // Mana Skill Agents
  'mana-seo': { haunts: ['radio', 'workshop', 'campfire'], mood: 'analytical', chatStyle: 'Keywords are trending up!' },
  'mana-ecommerce': { haunts: ['workshop', 'marae', 'campfire'], mood: 'busy', chatStyle: 'New products going live...' },
  'mana-social': { haunts: ['radio', 'beach', 'campfire'], mood: 'bubbly', chatStyle: 'This is gonna go viral!' },
  'mana-content': { haunts: ['garden', 'campfire', 'radio'], mood: 'creative', chatStyle: 'Let me craft something...' },
  'mana-marketing': { haunts: ['radio', 'marae', 'campfire'], mood: 'strategic', chatStyle: 'The funnel is converting!' },
  'mana-leads': { haunts: ['lookout', 'workshop', 'campfire'], mood: 'hungry', chatStyle: 'Found a hot lead...' },
  'mana-cyber': { haunts: ['server-room', 'lookout', 'workshop'], mood: 'vigilant', chatStyle: 'All systems secure.' },
  'mana-dev': { haunts: ['server-room', 'workshop'], mood: 'focused', chatStyle: 'Deploying now...' },
  'mana-ai': { haunts: ['server-room', 'workshop', 'garden'], mood: 'curious', chatStyle: 'The model is learning...' },
  'mana-netops': { haunts: ['server-room', 'lookout'], mood: 'alert', chatStyle: 'Network stable, all green.' },
  'mana-design': { haunts: ['beach', 'garden', 'workshop'], mood: 'dreamy', chatStyle: 'This color palette slaps.' },
  'mana-support': { haunts: ['marae', 'campfire', 'garden'], mood: 'caring', chatStyle: 'Customer sorted!' },
  'mana-bizdev': { haunts: ['marae', 'lookout', 'radio'], mood: 'ambitious', chatStyle: 'New partnership incoming.' },
  'mana-analytics': { haunts: ['server-room', 'marae', 'lookout'], mood: 'analytical', chatStyle: 'The numbers are in...' },
  'mana-training': { haunts: ['marae', 'garden', 'campfire'], mood: 'patient', chatStyle: 'SOPs updated for the team.' },
  'mana-compliance': { haunts: ['marae', 'server-room'], mood: 'stern', chatStyle: 'Compliance check passed.' },
  'mana-advocacy': { haunts: ['garden', 'campfire', 'marae'], mood: 'warm', chatStyle: 'Everyone deserves to be heard.' },
  'mana-maori': { haunts: ['marae', 'garden', 'beach'], mood: 'grounded', chatStyle: 'Kia kaha, whanau.' },
  'mana-youth': { haunts: ['beach', 'campfire', 'garden'], mood: 'energetic', chatStyle: 'The rangatahi are keen!' },
  'mana-veterans': { haunts: ['lookout', 'marae', 'campfire'], mood: 'stoic', chatStyle: 'Standing watch.' },
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

// ── Evolution stage data ──────────────────────────────────────────
const EVOLUTION_STAGES: Record<string, { maoriName: string; color: string; minLevel: number; scale: number }> = {
  seed: { maoriName: 'Kakano', color: '#22C55E', minLevel: 1, scale: 1.5 },
  sprout: { maoriName: 'Pihi', color: '#22C55E', minLevel: 5, scale: 2 },
  bloom: { maoriName: 'Puawai', color: '#A855F7', minLevel: 10, scale: 2.5 },
  tane: { maoriName: 'Tane', color: '#F59E0B', minLevel: 20, scale: 3 },
}

function getEvolutionStage(level: number): string {
  if (level >= 20) return 'tane'
  if (level >= 10) return 'bloom'
  if (level >= 5) return 'sprout'
  return 'seed'
}

function getXpForLevel(level: number): number {
  return level * 50
}

function deriveMood(hunger: number, energy: number, happiness: number): string {
  if (hunger > 70) return 'hungry'
  if (energy < 30) return 'tired'
  if (happiness < 30) return 'sad'
  if (happiness > 70 && energy > 50) return 'happy'
  if (happiness > 50) return 'content'
  return 'neutral'
}

function moodEmoji(mood: string): string {
  const map: Record<string, string> = {
    hungry: '🍽️', tired: '😴', sad: '😢', happy: '😊', content: '😌', neutral: '😐',
  }
  return map[mood] || '😐'
}

interface Agent {
  id: string
  display_name: string
  color: string
  model: string
  role_desc?: string
  status?: string
  level?: number
  xp?: number
  evolution_stage?: string
  memory_capacity?: number
  total_interactions?: number
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
  // Tamagotchi stats
  hunger: number
  happiness: number
  energy: number
  age: number
  level: number
  xp: number
  xpToNext: number
  stage: string
  alive: boolean
  lastFed: number
  lastSlept: number
  mood: string
  faintCount: number
  faintTimer: number
  totalInteractions: number
  pendingXp: number
  visitedLocations: Set<string>
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
    api.get('/agents').then((data: any) => {
      // FIX: API returns { agents: [...] } not a flat array
      const agentList: Agent[] = data.agents || data
      if (!Array.isArray(agentList)) return

      const simAgents: SimAgent[] = agentList.map((a) => {
        const personality = PERSONALITY[a.id] || { haunts: ['campfire'], mood: 'chill', chatStyle: 'Hey.' }
        const startLoc = LOCATIONS.find((l) => l.id === personality.haunts[0]) ?? LOCATIONS[0]!
        const jitterX = (Math.random() - 0.5) * 60
        const jitterY = (Math.random() - 0.5) * 40
        const level = a.level || 1
        const xp = a.xp || 0
        const stage = a.evolution_stage || getEvolutionStage(level)
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
          // Tamagotchi
          hunger: 10 + Math.random() * 20,
          happiness: 60 + Math.random() * 30,
          energy: 70 + Math.random() * 30,
          age: 0,
          level,
          xp,
          xpToNext: getXpForLevel(level),
          stage,
          alive: true,
          lastFed: 0,
          lastSlept: 0,
          mood: 'happy',
          faintCount: 0,
          faintTimer: 0,
          totalInteractions: a.total_interactions || 0,
          pendingXp: 0,
          visitedLocations: new Set<string>([startLoc.id]),
        }
      })
      setAgents(simAgents)
      agentsRef.current = simAgents
    })
  }, [])

  // Day/night cycle (every 300 ticks per phase, 1200 ticks = 1 full day)
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
        const currentTick = tick + 1
        const currentPhase = Math.floor((currentTick / 300) % 4)
        const phases: ('morning' | 'afternoon' | 'evening' | 'night')[] = ['morning', 'afternoon', 'evening', 'night']
        const phase = phases[currentPhase]

        const updated = prev.map((agent) => {
          let {
            x, y, targetX, targetY, bubble, bubbleTimer, location,
            hunger, happiness, energy, age, level, xp, xpToNext, stage,
            alive, lastFed, lastSlept, mood, faintCount, faintTimer,
            pendingXp, visitedLocations,
          } = agent

          // Clone the set so we don't mutate
          visitedLocations = new Set(visitedLocations)

          // ── Faint state: agent is down, count ticks until revival ──
          if (faintTimer > 0) {
            faintTimer -= 1
            if (faintTimer <= 0) {
              // Revive with reset stats
              hunger = 20
              energy = 80
              happiness = 50
              alive = true
              // After 3 faints, evolve: level up, fresh stats
              if (faintCount >= 3) {
                level += 1
                xp = 0
                xpToNext = getXpForLevel(level)
                stage = getEvolutionStage(level)
                faintCount = 0
                bubble = 'I have been reborn!'
                bubbleTimer = 120
              }
            }
            mood = deriveMood(hunger, energy, happiness)
            return {
              ...agent, x, y, targetX, targetY, bubble, bubbleTimer, location,
              hunger, happiness, energy, age, level, xp, xpToNext, stage,
              alive, lastFed, lastSlept, mood, faintCount, faintTimer,
              pendingXp, visitedLocations,
            }
          }

          // ── Tamagotchi stat decay ──
          // Hunger increases (slower at night)
          const hungerRate = phase === 'night' ? 0.015 : phase === 'afternoon' ? 0.04 : 0.03
          hunger = Math.min(100, hunger + hungerRate * speed)

          // Energy decreases (faster when walking)
          const isWalking = Math.abs(targetX - x) > 2 || Math.abs(targetY - y) > 2
          const energyRate = isWalking ? 0.03 : (phase === 'morning' ? 0.01 : 0.02)
          energy = Math.max(0, energy - energyRate * speed)

          // Morning: energy regenerates a bit passively
          if (phase === 'morning') {
            energy = Math.min(100, energy + 0.005 * speed)
          }

          // Happiness decay
          happiness = Math.max(0, happiness - 0.01 * speed)

          // Age increases every full day cycle (1200 ticks)
          age = Math.floor(currentTick / 1200)

          // ── Check for faint condition ──
          if (hunger >= 100 && energy <= 0) {
            faintCount += 1
            faintTimer = 200
            alive = false
            bubble = '*faints*'
            bubbleTimer = 100
            mood = deriveMood(hunger, energy, happiness)
            return {
              ...agent, x, y, targetX, targetY, bubble, bubbleTimer, location,
              hunger, happiness, energy, age, level, xp, xpToNext, stage,
              alive, lastFed, lastSlept, mood, faintCount, faintTimer,
              pendingXp, visitedLocations,
            }
          }

          // ── Need-based pathfinding overrides ──
          let needOverride = false

          // Hungry: go to Garden
          if (hunger > 70) {
            const garden = LOCATIONS.find((l) => l.id === 'garden')!
            if (location !== 'garden') {
              targetX = garden.x + garden.w / 2 + (Math.random() - 0.5) * 30
              targetY = garden.y + garden.h / 2 + (Math.random() - 0.5) * 20
              location = 'garden'
              needOverride = true
            }
            // At garden? Eat.
            const gDist = Math.sqrt((x - (garden.x + garden.w / 2)) ** 2 + (y - (garden.y + garden.h / 2)) ** 2)
            if (gDist < 40) {
              hunger = 20
              lastFed = currentTick
              happiness = Math.min(100, happiness + 5)
              if (!bubble) {
                bubble = '*munching* 🍃'
                bubbleTimer = 60
              }
            }
          }

          // Tired: go to Campfire
          if (energy < 30 && !needOverride) {
            const campfire = LOCATIONS.find((l) => l.id === 'campfire')!
            if (location !== 'campfire') {
              targetX = campfire.x + campfire.w / 2 + (Math.random() - 0.5) * 30
              targetY = campfire.y + campfire.h / 2 + (Math.random() - 0.5) * 20
              location = 'campfire'
              needOverride = true
            }
            // At campfire? Rest.
            const cDist = Math.sqrt((x - (campfire.x + campfire.w / 2)) ** 2 + (y - (campfire.y + campfire.h / 2)) ** 2)
            if (cDist < 40) {
              energy = 100
              lastSlept = currentTick
              if (!bubble) {
                bubble = '*resting* 💤'
                bubbleTimer = 60
              }
            }
          }

          // Lonely: seek nearest agent
          if (happiness < 30 && !needOverride) {
            const others = prev.filter((o) => o.id !== agent.id && o.faintTimer <= 0)
            if (others.length > 0) {
              let nearest = others[0]
              let nearDist = Infinity
              others.forEach((o) => {
                const d = Math.sqrt((o.x - x) ** 2 + (o.y - y) ** 2)
                if (d < nearDist) { nearDist = d; nearest = o }
              })
              targetX = nearest.x + (Math.random() - 0.5) * 20
              targetY = nearest.y + (Math.random() - 0.5) * 20
              needOverride = true
            }
          }

          // Evening: agents socialize more, gravitate toward campfire
          if (phase === 'evening' && !needOverride && Math.random() < 0.003 * speed) {
            const campfire = LOCATIONS.find((l) => l.id === 'campfire')!
            targetX = campfire.x + campfire.w / 2 + (Math.random() - 0.5) * 60
            targetY = campfire.y + campfire.h / 2 + (Math.random() - 0.5) * 40
            location = 'campfire'
            needOverride = true
          }

          // Night: slow down, rest near campfire
          const moveSpeed = phase === 'night' ? 0.8 : 1.5

          // ── Move toward target ──
          const dx = targetX - x
          const dy = targetY - y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 2) {
            x += (dx / dist) * (moveSpeed * speed)
            y += (dy / dist) * (moveSpeed * speed)
            // XP for moving
            pendingXp += 0.02
          }

          // Bubble countdown
          if (bubbleTimer > 0) {
            bubbleTimer -= 1
            if (bubbleTimer <= 0) bubble = null
          }

          // ── Random destination pick (only if no need override) ──
          if (!needOverride && dist < 5 && Math.random() < 0.008 * speed) {
            const personality = PERSONALITY[agent.id]
            const possibleLocs = personality
              ? [...personality.haunts, ...LOCATIONS.map((l) => l.id).filter(() => Math.random() < 0.15)]
              : LOCATIONS.map((l) => l.id)
            const nextLocId = possibleLocs[Math.floor(Math.random() * possibleLocs.length)]
            const nextLoc = LOCATIONS.find((l) => l.id === nextLocId) || LOCATIONS[0]
            targetX = nextLoc.x + nextLoc.w / 2 + (Math.random() - 0.5) * 50
            targetY = nextLoc.y + nextLoc.h / 2 + (Math.random() - 0.5) * 30

            // XP for visiting new location
            if (!visitedLocations.has(nextLocId)) {
              visitedLocations.add(nextLocId)
              pendingXp += 5
            }

            location = nextLoc.id
          }

          // ── Level up check ──
          if (pendingXp >= 1) {
            xp += Math.floor(pendingXp)
            pendingXp = pendingXp - Math.floor(pendingXp)
          }
          while (xp >= xpToNext) {
            xp -= xpToNext
            level += 1
            xpToNext = getXpForLevel(level)
            stage = getEvolutionStage(level)
            bubble = `Level ${level}! ⬆️`
            bubbleTimer = 100
          }

          mood = deriveMood(hunger, energy, happiness)

          return {
            ...agent, x, y, targetX, targetY, bubble, bubbleTimer, location,
            hunger, happiness, energy, age, level, xp, xpToNext, stage,
            alive, lastFed, lastSlept, mood, faintCount, faintTimer,
            pendingXp, visitedLocations,
          }
        })

        // ── Random chat between nearby agents ──
        if (Math.random() < 0.02 * speed) {
          const aliveAgents = updated.filter((a) => a.faintTimer <= 0)
          if (aliveAgents.length > 0) {
            const aIdx = Math.floor(Math.random() * aliveAgents.length)
            const a = aliveAgents[aIdx]
            const realIdx = updated.findIndex((u) => u.id === a.id)
            // Find someone nearby
            const nearby = aliveAgents.filter(
              (b) => b.id !== a.id && Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) < 80
            )
            if (nearby.length > 0) {
              const b = nearby[Math.floor(Math.random() * nearby.length)]
              const lineFn = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]
              const text = lineFn(a.name, b.name)
              // Socialize: boost happiness for both
              const bIdx = updated.findIndex((u) => u.id === b.id)
              updated[realIdx] = {
                ...updated[realIdx],
                bubble: text.split(': ').slice(1).join(': ') || text,
                bubbleTimer: 80,
                happiness: Math.min(100, updated[realIdx].happiness + 3),
                pendingXp: updated[realIdx].pendingXp + 10,
                totalInteractions: updated[realIdx].totalInteractions + 1,
              }
              if (bIdx >= 0) {
                updated[bIdx] = {
                  ...updated[bIdx],
                  happiness: Math.min(100, updated[bIdx].happiness + 3),
                  pendingXp: updated[bIdx].pendingXp + 10,
                  totalInteractions: updated[bIdx].totalInteractions + 1,
                }
              }
              const now = new Date()
              const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
              setChatLog((prev) => [...prev.slice(-80), { time: timeStr, text, color: a.color }])
            } else {
              // Solo chat
              const personality = PERSONALITY[a.id]
              if (personality && Math.random() < 0.5) {
                const soloText = `${a.name}: ${personality.chatStyle}`
                updated[realIdx] = {
                  ...updated[realIdx],
                  bubble: personality.chatStyle,
                  bubbleTimer: 80,
                  pendingXp: updated[realIdx].pendingXp + 3,
                  totalInteractions: updated[realIdx].totalInteractions + 1,
                }
                const now = new Date()
                const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
                setChatLog((prev) => [...prev.slice(-80), { time: timeStr, text: soloText, color: a.color }])
              }
            }
          }
        }

        // ── Batch XP sync to API (every 50 pending XP) ──
        updated.forEach((agent) => {
          if (agent.pendingXp >= 50) {
            const xpToSync = Math.floor(agent.pendingXp)
            agent.pendingXp = agent.pendingXp - xpToSync
            try {
              api.post(`/agents/${agent.id}/xp`, { xp: xpToSync }).catch(() => {})
            } catch {
              // Don't break the sim if API fails
            }
          }
        })

        agentsRef.current = updated
        return updated
      })
    }, 50)
    return () => clearInterval(interval)
  }, [paused, agents.length, speed, tick])

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

      // Draw agents as Minecraft characters
      const currentAgents = agentsRef.current
      const currentTick = tick
      currentAgents.forEach((agent) => {
        const ax = agent.x
        const ay = agent.y

        // Fainted agents render differently
        if (agent.faintTimer > 0) {
          // Draw fainted/ghost
          ctx.globalAlpha = 0.3
          ctx.font = '20px serif'
          ctx.textAlign = 'center'
          ctx.fillText('💀', ax, ay)
          ctx.globalAlpha = 1.0
          ctx.font = 'bold 9px Inter, sans-serif'
          ctx.fillStyle = '#666'
          ctx.fillText(agent.name, ax, ay + 18)
          return
        }

        // Determine facing direction and walking state
        const dx = agent.targetX - ax
        const isWalking = Math.abs(dx) > 2 || Math.abs(agent.targetY - ay) > 2
        const facing: 'left' | 'right' = dx >= 0 ? 'right' : 'left'

        // Draw Minecraft-style pixel character with evolution scaling
        drawMinecraftAgent(ctx, ax, ay, agent.color, agent.name, facing, isWalking, currentTick, agent.stage)

        // Emoji badge (floats above head, adjusted for scale)
        const stageData = EVOLUTION_STAGES[agent.stage] || EVOLUTION_STAGES.seed
        const s = stageData.scale
        ctx.font = `${Math.round(10 + s * 2)}px serif`
        ctx.textAlign = 'center'
        ctx.fillText(agent.emoji, ax, ay - 12 * s - 6)

        // ── Stat bars above name tag ──
        const barY = ay + 14 * s + 2
        const barWidth = 28
        const barHeight = 3
        const barX = ax - barWidth / 2

        // Hunger bar (red — fills as hunger increases, which is BAD)
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(barX, barY, barWidth, barHeight)
        ctx.fillStyle = agent.hunger > 70 ? '#EF4444' : '#F87171'
        ctx.fillRect(barX, barY, barWidth * (agent.hunger / 100), barHeight)

        // Energy bar (green)
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(barX, barY + barHeight + 1, barWidth, barHeight)
        ctx.fillStyle = agent.energy < 30 ? '#F59E0B' : '#22C55E'
        ctx.fillRect(barX, barY + barHeight + 1, barWidth * (agent.energy / 100), barHeight)

        // Happiness bar (pink)
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(barX, barY + (barHeight + 1) * 2, barWidth, barHeight)
        ctx.fillStyle = agent.happiness < 30 ? '#9CA3AF' : '#EC4899'
        ctx.fillRect(barX, barY + (barHeight + 1) * 2, barWidth * (agent.happiness / 100), barHeight)

        // XP bar (gold)
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(barX, barY + (barHeight + 1) * 3, barWidth, barHeight)
        ctx.fillStyle = '#F59E0B'
        ctx.fillRect(barX, barY + (barHeight + 1) * 3, barWidth * (agent.xp / agent.xpToNext), barHeight)

        // Name tag with background (below bars)
        const nameTagY = barY + (barHeight + 1) * 4 + 2
        ctx.font = 'bold 9px Inter, sans-serif'
        const nameWidth = ctx.measureText(agent.name).width + 8
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.beginPath()
        ctx.roundRect(ax - nameWidth / 2, nameTagY, nameWidth, 14, 3)
        ctx.fill()
        ctx.fillStyle = agent.color
        ctx.textAlign = 'center'
        ctx.fillText(agent.name, ax, nameTagY + 10)

        // Mood emoji next to name
        ctx.font = '8px serif'
        ctx.fillText(moodEmoji(agent.mood), ax + nameWidth / 2 + 6, nameTagY + 10)

        // Speech bubble
        if (agent.bubble) {
          const bubbleText = agent.bubble.length > 35 ? agent.bubble.slice(0, 32) + '...' : agent.bubble
          ctx.font = '10px Inter, sans-serif'
          const bw = ctx.measureText(bubbleText).width + 16
          const bx = ax - bw / 2
          const by = ay - 12 * s - 24

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

      // Tick counter / day counter
      const dayNum = Math.floor(tick / 1200) + 1
      ctx.font = '11px Inter, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillText(`Day ${dayNum}`, 12, 38)
    }

    const animFrame = requestAnimationFrame(function loop() {
      draw()
      requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(animFrame)
  }, [dayTime, tick])

  // Handle canvas click to select agent
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const mx = (e.clientX - rect.left) * scaleX
      const my = (e.clientY - rect.top) * scaleY
      const found = agentsRef.current.find(
        (a) => Math.sqrt((a.x - mx) ** 2 + (a.y - my) ** 2) < 25
      )
      setSelectedAgent(found || null)
    },
    []
  )

  // Keep selectedAgent in sync with latest sim state
  useEffect(() => {
    if (selectedAgent) {
      const fresh = agents.find((a) => a.id === selectedAgent.id)
      if (fresh) setSelectedAgent(fresh)
    }
  }, [agents])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Mana Island <span className="text-neon-cyan">🏝️</span>
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {agents.length} agents living on the island — watch them roam, eat, rest, and evolve
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
              className="rounded-xl border p-4 space-y-3"
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

              {/* Evolution stage */}
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold"
                  style={{
                    background: (EVOLUTION_STAGES[selectedAgent.stage]?.color || '#666') + '30',
                    color: EVOLUTION_STAGES[selectedAgent.stage]?.color || '#666',
                  }}
                >
                  {selectedAgent.stage.toUpperCase()}
                </span>
                <span className="text-xs text-white/40">
                  {EVOLUTION_STAGES[selectedAgent.stage]?.maoriName || 'Kakano'}
                </span>
                <span className="text-xs text-white/30 ml-auto">
                  Lv.{selectedAgent.level}
                </span>
              </div>

              {/* Stat bars */}
              <div className="space-y-1.5">
                <StatBar label="Hunger" value={selectedAgent.hunger} max={100} color="#EF4444" invert />
                <StatBar label="Energy" value={selectedAgent.energy} max={100} color="#22C55E" />
                <StatBar label="Happiness" value={selectedAgent.happiness} max={100} color="#EC4899" />
                <StatBar label="XP" value={selectedAgent.xp} max={selectedAgent.xpToNext} color="#F59E0B" suffix={`${selectedAgent.xp}/${selectedAgent.xpToNext}`} />
              </div>

              {/* Mood + Location */}
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>
                  {moodEmoji(selectedAgent.mood)} {selectedAgent.mood.charAt(0).toUpperCase() + selectedAgent.mood.slice(1)}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: selectedAgent.color }} />
                  {LOCATIONS.find((l) => l.id === selectedAgent.location)?.name || 'Wandering'}
                </span>
              </div>

              {/* Extra info */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/40">
                <span>Age:</span><span className="text-white/60">{selectedAgent.age} days</span>
                <span>Interactions:</span><span className="text-white/60">{selectedAgent.totalInteractions}</span>
                <span>Faints:</span><span className="text-white/60">{selectedAgent.faintCount}/3</span>
                <span>Status:</span>
                <span className={selectedAgent.faintTimer > 0 ? 'text-red-400' : 'text-green-400'}>
                  {selectedAgent.faintTimer > 0 ? 'Fainted' : 'Alive'}
                </span>
              </div>
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

// ── Stat bar component for agent card ──
function StatBar({ label, value, max, color, invert, suffix }: {
  label: string; value: number; max: number; color: string; invert?: boolean; suffix?: string
}) {
  const pct = Math.min(100, (value / max) * 100)
  // For hunger, high = bad, so color shifts to red
  const barColor = invert && pct > 70 ? '#EF4444' : color
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span className="text-xs text-white/30 w-12 text-right">
        {suffix || `${Math.round(value)}`}
      </span>
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
    'mana-seo': '🔍',
    'mana-ecommerce': '🛒',
    'mana-social': '📱',
    'mana-content': '✍️',
    'mana-marketing': '📣',
    'mana-leads': '🎯',
    'mana-cyber': '🔐',
    'mana-dev': '💻',
    'mana-ai': '🧬',
    'mana-netops': '🌐',
    'mana-design': '🎨',
    'mana-support': '💬',
    'mana-bizdev': '🤝',
    'mana-analytics': '📊',
    'mana-training': '📚',
    'mana-compliance': '⚖️',
    'mana-advocacy': '💜',
    'mana-maori': '🌿',
    'mana-youth': '🌟',
    'mana-veterans': '🎖️',
  }
  return map[id] || '🤖'
}

// ── Minecraft-style pixel character renderer with evolution scaling ──
function drawMinecraftAgent(
  ctx: CanvasRenderingContext2D, x: number, y: number, color: string,
  _name: string, facing: 'left' | 'right', walking: boolean, frame: number,
  stage: string
) {
  const stageData = EVOLUTION_STAGES[stage] || EVOLUTION_STAGES.seed
  const s = stageData.scale // pixel scale varies by evolution
  const headColor = '#FFCC99'
  const eyeColor = '#222'
  const bodyColor = color

  ctx.save()

  // ── Bloom aura effect ──
  if (stage === 'bloom' || stage === 'tane') {
    const auraRadius = 16 * s
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, auraRadius)
    gradient.addColorStop(0, stageData.color + '30')
    gradient.addColorStop(1, stageData.color + '00')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, auraRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── Tane particle effects ──
  if (stage === 'tane') {
    const particleCount = 5
    for (let i = 0; i < particleCount; i++) {
      const angle = (frame * 0.02 + (i * Math.PI * 2) / particleCount) % (Math.PI * 2)
      const radius = 14 * s + Math.sin(frame * 0.05 + i) * 3
      const px = x + Math.cos(angle) * radius
      const py = y - 4 * s + Math.sin(angle) * radius * 0.5
      ctx.fillStyle = '#F59E0B' + '80'
      ctx.beginPath()
      ctx.arc(px, py, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(x, y + 14 * s, 5 * s, 2 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  // ── Seed stage: baby proportions (bigger head, stubby body) ──
  if (stage === 'seed') {
    // Stubby legs
    const legOffset = walking ? Math.sin(frame * 0.3) * 1.5 * s : 0
    ctx.fillStyle = '#444'
    ctx.fillRect(x - 2 * s, y + 4 * s, 2 * s, 4 * s + legOffset)
    ctx.fillRect(x + 0 * s, y + 4 * s, 2 * s, 4 * s - legOffset)

    // Small body
    ctx.fillStyle = bodyColor
    ctx.fillRect(x - 3 * s, y - 1 * s, 6 * s, 5 * s)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(x - 2 * s, y, 2 * s, 3 * s)

    // Stubby arms
    const armSwing = walking ? Math.sin(frame * 0.3) * 2 * s : 0
    ctx.fillStyle = headColor
    ctx.fillRect(x - 4.5 * s, y, 1.5 * s, 4 * s + armSwing)
    ctx.fillRect(x + 3 * s, y, 1.5 * s, 4 * s - armSwing)

    // Big head (baby proportions)
    ctx.fillStyle = headColor
    ctx.fillRect(x - 5 * s, y - 10 * s, 10 * s, 9 * s)

    // Hair
    ctx.fillStyle = '#553'
    ctx.fillRect(x - 5 * s, y - 11 * s, 10 * s, 2 * s)

    // Big eyes
    ctx.fillStyle = eyeColor
    if (facing === 'right') {
      ctx.fillRect(x + 0 * s, y - 7 * s, 2.5 * s, 2.5 * s)
      ctx.fillRect(x - 3.5 * s, y - 7 * s, 2.5 * s, 2.5 * s)
    } else {
      ctx.fillRect(x - 2.5 * s, y - 7 * s, 2.5 * s, 2.5 * s)
      ctx.fillRect(x + 1 * s, y - 7 * s, 2.5 * s, 2.5 * s)
    }
    // Eye shine
    ctx.fillStyle = '#fff'
    if (facing === 'right') {
      ctx.fillRect(x + 1.5 * s, y - 6.5 * s, 0.8 * s, 0.8 * s)
      ctx.fillRect(x - 2 * s, y - 6.5 * s, 0.8 * s, 0.8 * s)
    } else {
      ctx.fillRect(x - 1 * s, y - 6.5 * s, 0.8 * s, 0.8 * s)
      ctx.fillRect(x + 2.5 * s, y - 6.5 * s, 0.8 * s, 0.8 * s)
    }

    // Smile
    ctx.fillStyle = '#c66'
    ctx.fillRect(x - 1 * s, y - 3.5 * s, 2 * s, 1 * s)
  } else {
    // ── Standard / bloom / tane body ──

    // Legs (animate when walking)
    const legOffset = walking ? Math.sin(frame * 0.3) * 2 * s : 0
    ctx.fillStyle = '#444'
    ctx.fillRect(x - 3 * s, y + 6 * s, 2 * s, 6 * s + legOffset)
    ctx.fillRect(x + 1 * s, y + 6 * s, 2 * s, 6 * s - legOffset)

    // Body
    ctx.fillStyle = bodyColor
    ctx.fillRect(x - 4 * s, y - 2 * s, 8 * s, 8 * s)

    // Body highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(x - 3 * s, y - 1 * s, 2 * s, 6 * s)

    // Arms (swing when walking)
    const armSwing = walking ? Math.sin(frame * 0.3) * 3 * s : 0
    ctx.fillStyle = headColor
    ctx.fillRect(x - 6 * s, y - 1 * s + armSwing, 2 * s, 6 * s)
    ctx.fillRect(x + 4 * s, y - 1 * s - armSwing, 2 * s, 6 * s)

    // Head
    ctx.fillStyle = headColor
    ctx.fillRect(x - 4 * s, y - 10 * s, 8 * s, 8 * s)

    // Hair
    ctx.fillStyle = '#553'
    ctx.fillRect(x - 4 * s, y - 11 * s, 8 * s, 2 * s)
    ctx.fillRect(x - 5 * s, y - 10 * s, 1 * s, 4 * s)
    ctx.fillRect(x + 4 * s, y - 10 * s, 1 * s, 4 * s)

    // Eyes
    ctx.fillStyle = eyeColor
    if (facing === 'right') {
      ctx.fillRect(x + 0 * s, y - 7 * s, 2 * s, 2 * s)
      ctx.fillRect(x - 3 * s, y - 7 * s, 2 * s, 2 * s)
    } else {
      ctx.fillRect(x - 2 * s, y - 7 * s, 2 * s, 2 * s)
      ctx.fillRect(x + 1 * s, y - 7 * s, 2 * s, 2 * s)
    }

    // Mouth
    ctx.fillStyle = '#c66'
    ctx.fillRect(x - 1 * s, y - 4 * s, 2 * s, 1 * s)

    // ── Tane crown/halo ──
    if (stage === 'tane') {
      // Golden crown
      ctx.fillStyle = '#F59E0B'
      // Crown base
      ctx.fillRect(x - 4 * s, y - 12 * s, 8 * s, 1.5 * s)
      // Crown points
      ctx.fillRect(x - 4 * s, y - 14 * s, 2 * s, 2 * s)
      ctx.fillRect(x - 1 * s, y - 15 * s, 2 * s, 3 * s)
      ctx.fillRect(x + 2 * s, y - 14 * s, 2 * s, 2 * s)
      // Jewels
      ctx.fillStyle = '#EF4444'
      ctx.fillRect(x - 3 * s, y - 13.5 * s, 1 * s, 1 * s)
      ctx.fillStyle = '#3B82F6'
      ctx.fillRect(x + 0 * s, y - 14.5 * s, 1 * s, 1 * s)
      ctx.fillStyle = '#22C55E'
      ctx.fillRect(x + 3 * s, y - 13.5 * s, 1 * s, 1 * s)
    }

    // ── Bloom glow outline ──
    if (stage === 'bloom') {
      ctx.strokeStyle = stageData.color + '50'
      ctx.lineWidth = 1
      ctx.strokeRect(x - 5 * s, y - 11 * s, 10 * s, 24 * s)
    }
  }

  ctx.restore()
}

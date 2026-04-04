import { useState } from 'react'
import { api } from '../lib/api'
import {
  X,
  Check,
  ChevronRight,
  AlertTriangle,
  Bot,
  Globe,
  Zap,
  Shield,
  RefreshCw,
} from 'lucide-react'

interface InstallAgentModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface TemplateOption {
  id: string
  label: string
  color: string
  icon: typeof Bot
  description: string
  defaultRole: string
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'content',
    label: 'Content',
    color: '#EC4899',
    icon: Globe,
    description: 'Creative writing, social media, blog posts',
    defaultRole: 'Content creation and creative writing assistant',
  },
  {
    id: 'code',
    label: 'Code',
    color: '#F97316',
    icon: Zap,
    description: 'Code generation, review, debugging',
    defaultRole: 'Code generation and technical development assistant',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    color: '#3B82F6',
    icon: Bot,
    description: 'Planning, analysis, decision-making',
    defaultRole: 'Strategic planning and analysis assistant',
  },
  {
    id: 'security',
    label: 'Security',
    color: '#EF4444',
    icon: Shield,
    description: 'Security audits, monitoring, threat detection',
    defaultRole: 'Security monitoring and threat analysis assistant',
  },
  {
    id: 'custom',
    label: 'Custom',
    color: '#06B6D4',
    icon: Bot,
    description: 'Build from scratch with custom configuration',
    defaultRole: '',
  },
]

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

const PRESET_COLORS = [
  '#EC4899',
  '#F97316',
  '#3B82F6',
  '#EF4444',
  '#06B6D4',
  '#22C55E',
  '#A855F7',
  '#F59E0B',
]

export default function InstallAgentModal({ onClose, onSuccess }: InstallAgentModalProps) {
  const [step, setStep] = useState(1)

  // Step 1: template
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null)

  // Step 2: config
  const [agentId, setAgentId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [model, setModel] = useState(MODEL_OPTIONS[0])
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [telegramToken, setTelegramToken] = useState('')
  const [role, setRole] = useState('')

  // Step 3: install
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState('')
  const [installSuccess, setInstallSuccess] = useState(false)

  function handleTemplateSelect(template: TemplateOption) {
    setSelectedTemplate(template)
    setColor(template.color)
    setRole(template.defaultRole)
    setStep(2)
  }

  function handleConfigNext() {
    if (!agentId.trim() || !displayName.trim()) return
    setStep(3)
  }

  async function handleInstall() {
    setInstalling(true)
    setInstallError('')
    try {
      await api.post('/agents', {
        id: agentId.trim().toLowerCase().replace(/\s+/g, '-'),
        display_name: displayName.trim(),
        model,
        color,
        role: role.trim(),
        telegram_token: telegramToken.trim() || undefined,
        template: selectedTemplate?.id,
      })
      setInstallSuccess(true)
      setTimeout(() => {
        onSuccess()
      }, 1000)
    } catch (err: any) {
      setInstallError(err.message || 'Failed to install agent')
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-void-dark max-w-lg w-full rounded-xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white">Install New Agent</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Step {step} of 3 -{' '}
              {step === 1 ? 'Choose Template' : step === 2 ? 'Configure' : 'Review & Install'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  s < step
                    ? 'bg-green-500 text-white'
                    : s === step
                      ? 'bg-neon-cyan text-void-black'
                      : 'bg-white/5 text-white/30'
                }`}
              >
                {s < step ? <Check size={14} /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    s < step ? 'bg-green-500' : 'bg-white/5'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="p-6">
          {/* Step 1: Choose Template */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-white/50 mb-4">
                Choose a template to get started quickly
              </p>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleTemplateSelect(tmpl)}
                    className="bg-void-gray border border-white/5 rounded-lg p-4 text-left hover:border-white/10 transition-colors group"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                      style={{ backgroundColor: `${tmpl.color}15` }}
                    >
                      <tmpl.icon size={20} style={{ color: tmpl.color }} />
                    </div>
                    <h4 className="text-sm font-bold text-white group-hover:text-neon-cyan transition-colors">
                      {tmpl.label}
                    </h4>
                    <p className="text-xs text-white/40 mt-1">{tmpl.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Agent ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) =>
                    setAgentId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  }
                  className="w-full bg-void-black border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                  placeholder="my-agent"
                />
                <p className="text-[10px] text-white/30 mt-1">
                  Lowercase, hyphens only. Used as unique identifier.
                </p>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Display Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-void-black border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                  placeholder="My Agent"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-void-black border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-cyan/50 transition-colors appearance-none cursor-pointer"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m} className="bg-void-dark">
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Color</label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        color === c
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-void-dark scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Telegram Bot Token{' '}
                  <span className="text-white/20">(optional)</span>
                </label>
                <input
                  type="password"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="w-full bg-void-black border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                  placeholder="Bot token from @BotFather"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Role Description</label>
                <textarea
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-void-black border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-neon-cyan/50 transition-colors"
                  placeholder="Describe what this agent does..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-white/40 hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfigNext}
                  disabled={!agentId.trim() || !displayName.trim()}
                  className="flex items-center gap-2 bg-neon-cyan text-void-black font-semibold px-4 py-2.5 rounded-lg hover:bg-neon-cyan/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Install */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-white/50 mb-2">
                Review your agent configuration before installing
              </p>

              <div className="bg-void-gray rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      backgroundColor: `${color}20`,
                      color: color,
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{displayName}</h4>
                    <span className="text-xs text-white/40 font-mono">{agentId}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                  <div>
                    <span className="text-[10px] text-white/30 uppercase">Template</span>
                    <p className="text-xs text-white/70 mt-0.5">
                      {selectedTemplate?.label || 'Custom'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase">Model</span>
                    <p className="text-xs text-white/70 mt-0.5">{model}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase">Color</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-white/70 font-mono">{color}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase">Telegram</span>
                    <p className="text-xs text-white/70 mt-0.5">
                      {telegramToken ? 'Configured' : 'Not configured'}
                    </p>
                  </div>
                </div>

                {role && (
                  <div className="pt-3 border-t border-white/5">
                    <span className="text-[10px] text-white/30 uppercase">Role</span>
                    <p className="text-xs text-white/70 mt-0.5">{role}</p>
                  </div>
                )}
              </div>

              {installError && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} />
                  <span>{installError}</span>
                </div>
              )}

              {installSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 rounded-lg px-3 py-2">
                  <Check size={14} />
                  <span>Agent installed successfully!</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(2)}
                  disabled={installing || installSuccess}
                  className="text-sm text-white/40 hover:text-white transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleInstall}
                  disabled={installing || installSuccess}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    installSuccess
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-neon-cyan text-void-black hover:bg-neon-cyan/90'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {installing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Installing...
                    </>
                  ) : installSuccess ? (
                    <>
                      <Check size={14} />
                      Installed!
                    </>
                  ) : (
                    <>
                      <Bot size={14} />
                      Install Agent
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

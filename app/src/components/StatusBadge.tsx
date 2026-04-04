interface StatusBadgeProps {
  status: 'green' | 'amber' | 'red' | string
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

const colorMap: Record<string, { bg: string; glow: string }> = {
  green:   { bg: 'bg-agent-green',  glow: 'shadow-[0_0_6px_rgba(34,197,94,0.5)]' },
  online:  { bg: 'bg-agent-green',  glow: 'shadow-[0_0_6px_rgba(34,197,94,0.5)]' },
  active:  { bg: 'bg-agent-green',  glow: 'shadow-[0_0_6px_rgba(34,197,94,0.5)]' },
  healthy: { bg: 'bg-agent-green',  glow: 'shadow-[0_0_6px_rgba(34,197,94,0.5)]' },
  amber:   { bg: 'bg-amber-400',    glow: 'shadow-[0_0_6px_rgba(251,191,36,0.5)]' },
  idle:    { bg: 'bg-amber-400',    glow: 'shadow-[0_0_6px_rgba(251,191,36,0.5)]' },
  degraded:{ bg: 'bg-amber-400',    glow: 'shadow-[0_0_6px_rgba(251,191,36,0.5)]' },
  red:     { bg: 'bg-agent-red',    glow: 'shadow-[0_0_6px_rgba(239,68,68,0.5)]' },
  error:   { bg: 'bg-agent-red',    glow: 'shadow-[0_0_6px_rgba(239,68,68,0.5)]' },
  offline: { bg: 'bg-gray-500',     glow: '' },
  closed:  { bg: 'bg-gray-500',     glow: '' },
}

const labelMap: Record<string, string> = {
  green: 'Healthy',
  online: 'Online',
  active: 'Active',
  healthy: 'Healthy',
  amber: 'Degraded',
  idle: 'Idle',
  degraded: 'Degraded',
  red: 'Offline',
  error: 'Error',
  offline: 'Offline',
  closed: 'Closed',
}

const sizeMap = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3.5 h-3.5',
}

export default function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const normalized = status.toLowerCase()
  const colors = colorMap[normalized] || { bg: 'bg-gray-500', glow: '' }
  const displayLabel = label || labelMap[normalized] || status

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        className={`${sizeMap[size]} rounded-full ${colors.bg} ${colors.glow}`}
      />
      <span className="text-white/70">{displayLabel}</span>
    </span>
  )
}

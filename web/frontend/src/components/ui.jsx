import { Loader2 } from 'lucide-react'

/* ---------- Button ---------- */
const btnBase =
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer'

const btnSizes = {
  sm: 'text-xs px-3 py-1.5 rounded-lg',
  md: 'text-sm px-4 py-2 rounded-lg',
  lg: 'text-sm px-5 py-2.5 rounded-lg',
}

const btnVariants = {
  primary:
    'bg-[#7c5cfc] text-white hover:bg-[#9478ff] shadow-[0_0_16px_rgba(124,92,252,0.25)] hover:shadow-[0_0_24px_rgba(124,92,252,0.35)]',
  secondary:
    'bg-[#1c1c2b] text-[#c8c8e0] border border-[#2a2a42] hover:bg-[#24243a] hover:text-white hover:border-[#35355a]',
  danger:
    'bg-[#1c1c2b] text-[#f87171] border border-[rgba(248,113,113,0.2)] hover:bg-[rgba(248,113,113,0.08)] hover:border-[rgba(248,113,113,0.35)]',
  ghost:
    'text-[#8888a8] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#e8e8f0]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  children,
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      className={`${btnBase} ${btnSizes[size]} ${btnVariants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        Icon && <Icon size={16} />
      )}
      {children}
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({ className = '', hover = false, ...props }) {
  return (
    <div
      className={
        `bg-[#14141f] rounded-2xl border border-[#2a2a42] shadow-[var(--shadow-sm)] ` +
        `${hover ? 'transition-all duration-300 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 hover:border-[#35355a]' : ''} ${className}`
      }
      {...props}
    />
  )
}

/* ---------- Badge ---------- */
const badgeColors = {
  gray:   'bg-[rgba(255,255,255,0.06)] text-[#8888a8]',
  indigo: 'bg-[rgba(124,92,252,0.12)] text-[#b49aff]',
  blue:   'bg-[rgba(0,212,255,0.12)] text-[#66e0ff]',
  green:  'bg-[rgba(52,211,153,0.12)] text-[#6ee7b7]',
  red:    'bg-[rgba(248,113,113,0.12)] text-[#fca5a5]',
  amber:  'bg-[rgba(251,191,36,0.12)] text-[#fcd34d]',
  purple: 'bg-[rgba(168,85,247,0.12)] text-[#c084fc]',
}

export function Badge({ color = 'gray', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${badgeColors[color]} ${className}`}
    >
      {children}
    </span>
  )
}

/* ---------- StatusPill ---------- */
const statusMeta = {
  pending:   { label: '排队中', dot: 'bg-[#5a5a7a]',       text: 'text-[#8888a8]', bg: 'bg-[rgba(255,255,255,0.06)]' },
  running:   { label: '运行中', dot: 'bg-[#7c5cfc]',       text: 'text-[#b49aff]', bg: 'bg-[rgba(124,92,252,0.12)]' },
  awaiting_confirmation: { label: '等待确认', dot: 'bg-[#fbbf24]', text: 'text-[#fcd34d]', bg: 'bg-[rgba(251,191,36,0.12)]' },
  success:   { label: '成功',   dot: 'bg-[#34d399]',       text: 'text-[#6ee7b7]', bg: 'bg-[rgba(52,211,153,0.12)]' },
  failed:    { label: '失败',   dot: 'bg-[#f87171]',       text: 'text-[#fca5a5]', bg: 'bg-[rgba(248,113,113,0.12)]' },
  cancelled: { label: '已取消', dot: 'bg-[#5a5a7a]',       text: 'text-[#8888a8]', bg: 'bg-[rgba(255,255,255,0.06)]' },
}

export function StatusPill({ status }) {
  const meta = statusMeta[status] || statusMeta.pending
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.bg} ${meta.text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${status === 'running' ? 'vc-pulse-dot' : ''}`}
      />
      {meta.label}
    </span>
  )
}

/* ---------- ProgressBar ---------- */
export function ProgressBar({ value = 0, className = '' }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-[#1c1c2b] ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#7c5cfc] to-[#00d4ff] transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

/* ---------- EmptyState ---------- */
export function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {Icon && (
        <div className="mb-3 rounded-2xl bg-[rgba(255,255,255,0.04)] p-3.5">
          <Icon size={24} className="text-[#5a5a7a]" />
        </div>
      )}
      <p className="text-sm font-medium text-[#c8c8e0]">{title}</p>
      {description && <p className="mt-1 text-sm text-[#5a5a7a]">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

/* ---------- SectionHeader ---------- */
export function SectionHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-[#e8e8f0]">{title}</h1>
        {description && <p className="mt-1 text-sm text-[#8888a8]">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ---------- Field ---------- */
const inputCls =
  'w-full rounded-lg border border-[#2a2a42] bg-[#1c1c2b] px-3 py-2 text-sm text-[#e8e8f0] ' +
  'placeholder:text-[#5a5a7a] focus:border-[#7c5cfc] focus:outline-none focus:ring-1 focus:ring-[rgba(124,92,252,0.35)] ' +
  'transition-colors duration-200'

export function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-[#8888a8]">{label}</label>
      )}
      {children}
      {hint && <p className="mt-1 text-xs text-[#5a5a7a]">{hint}</p>}
    </div>
  )
}

export function TextInput(props) {
  return <input className={inputCls} {...props} />
}

export function SelectInput(props) {
  return <select className={`${inputCls} pr-8`} {...props} />
}

/* ---------- InfoBar ---------- */
const infoColors = {
  info:    'bg-[rgba(0,212,255,0.08)] text-[#66e0ff] border-[rgba(0,212,255,0.15)]',
  warn:    'bg-[rgba(251,191,36,0.08)] text-[#fcd34d] border-[rgba(251,191,36,0.15)]',
  error:   'bg-[rgba(248,113,113,0.08)] text-[#fca5a5] border-[rgba(248,113,113,0.15)]',
  success: 'bg-[rgba(52,211,153,0.08)] text-[#6ee7b7] border-[rgba(52,211,153,0.15)]',
}

export function InfoBar({ type = 'info', children }) {
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${infoColors[type]}`}>
      {children}
    </div>
  )
}

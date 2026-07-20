import { useEffect, useRef } from 'react'
import { TerminalSquare } from 'lucide-react'

/**
 * 深色运行日志终端：标题栏 + 自动滚底 + ERR 行染色
 */
export default function LogTerminal({ logs = [] }) {
  const bodyRef = useRef(null)

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs.length])

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2a2a42] bg-[#0a0a12] shadow-[var(--shadow-md)]">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 border-b border-[#2a2a42] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[rgba(248,113,113,0.7)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[rgba(251,191,36,0.7)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[rgba(52,211,153,0.7)]" />
        <span className="ml-2 flex items-center gap-1.5 text-xs text-[#5a5a7a]">
          <TerminalSquare size={13} />
          运行日志
        </span>
      </div>

      {/* 日志体 */}
      <div
        ref={bodyRef}
        className="log-terminal h-96 overflow-y-auto px-4 py-3 text-[#8888a8]"
      >
        {logs.length === 0 && (
          <div className="text-[#5a5a7a]">等待日志输出...</div>
        )}
        {logs.map((log, idx) => {
          const msg = log.message || ''
          const isErr = msg.startsWith('ERR:')
          return (
            <div key={idx} className="whitespace-pre-wrap break-all">
              <span className="text-[#5a5a7a]">[{log.step}]</span>{' '}
              <span className={isErr ? 'text-[#f87171]' : 'text-[#8888a8]'}>
                {msg}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

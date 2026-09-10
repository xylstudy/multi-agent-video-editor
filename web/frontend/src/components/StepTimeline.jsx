import { Check, Clapperboard, Images, Loader2, Sparkles, X } from 'lucide-react'

const STEP_DEFS = [
  { key: 'material_analysis', label: '素材分析', icon: Images },
  { key: 'video_analysis', label: '视频分析', icon: Clapperboard },
  { key: 'render', label: '渲染输出', icon: Sparkles, match: ['editing_transfer', 'pipeline'] },
]

// 不同任务类型对应不同的步骤序列
const TYPE_STEPS = {
  end_to_end: STEP_DEFS,
  material_analysis: [STEP_DEFS[0]],
  analyze_video: [STEP_DEFS[1]],
}

function mapStepKey(key) {
  const def = STEP_DEFS.find(
    (d) => d.key === key || (d.match && d.match.includes(key))
  )
  return def ? def.key : null
}

/**
 * 根据任务日志推导流水线各步骤状态。
 * taskType 决定展示哪些步骤（end_to_end 为全链路）。
 * 返回 [{ ...def, state: 'pending' | 'running' | 'done' | 'failed' }]
 */
function deriveSteps(logs = [], taskStatus = 'pending', taskType = 'end_to_end') {
  const defs = TYPE_STEPS[taskType] || STEP_DEFS
  const seenKeys = logs.map((l) => mapStepKey(l.step)).filter(Boolean)
  const lastKey = seenKeys.length ? seenKeys[seenKeys.length - 1] : null
  const lastIndex = defs.findIndex((d) => d.key === lastKey)

  return defs.map((def, i) => {
    let state = 'pending'
    if (taskStatus === 'success') {
      state = 'done'
    } else if (lastIndex >= 0) {
      if (i < lastIndex) state = 'done'
      else if (i === lastIndex) {
        state = taskStatus === 'failed' ? 'failed' : 'running'
      }
    }
    return { ...def, state }
  })
}

const stateStyles = {
  pending:  'border-[#2a2a42] bg-[#14141f] text-[#5a5a7a]',
  running:  'border-[#7c5cfc] bg-[rgba(124,92,252,0.12)] text-[#b49aff]',
  done:     'border-[#34d399] bg-[#34d399] text-white',
  failed:   'border-[#f87171] bg-[#f87171] text-white',
}
const labelStyles = {
  pending:  'text-[#5a5a7a]',
  running:  'text-[#b49aff] font-medium',
  done:     'text-[#c8c8e0]',
  failed:   'text-[#fca5a5] font-medium',
}

export default function StepTimeline({ logs = [], taskStatus = 'pending', taskType = 'end_to_end' }) {
  const steps = deriveSteps(logs, taskStatus, taskType)

  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const Icon = step.icon
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${stateStyles[step.state]}`}
              >
                {step.state === 'done' ? (
                  <Check size={16} strokeWidth={2.5} />
                ) : step.state === 'failed' ? (
                  <X size={16} strokeWidth={2.5} />
                ) : step.state === 'running' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Icon size={16} />
                )}
              </div>
              <span className={`mt-2 text-xs whitespace-nowrap ${labelStyles[step.state]}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-3 mb-6 h-0.5 flex-1 rounded transition-colors ${
                  steps[i + 1].state === 'done' ||
                  steps[i + 1].state === 'running' ||
                  step.state === 'done'
                    ? 'bg-[#34d399]'
                    : 'bg-[#2a2a42]'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

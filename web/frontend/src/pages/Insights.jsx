import { useEffect, useState } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import api from '../api.js'
import { getToken } from '../auth.js'
import { Badge, Card, EmptyState, SectionHeader } from '../components/ui.jsx'

const DIMENSION_LABELS = {
  hook: 'Hook 策略',
  rhythm: '节奏模式',
  shot_types: '镜头类型',
  emotion_arc: '情绪弧线',
  transitions: '转场使用',
}

const CONFIDENCE_BADGE = { high: 'green', medium: 'amber', low: 'gray' }
const CONFIDENCE_LABEL = { high: '高置信', medium: '中置信', low: '样本不足' }

export default function Insights() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reportKey, setReportKey] = useState(0)

  const load = () => {
    setLoading(true)
    api
      .get('/insights')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading && !data) {
    return <div className="py-16 text-center text-sm text-[#5a5a7a]">加载中...</div>
  }

  const reportUrl = `/api/insights/report?token=${encodeURIComponent(getToken() || '')}`

  return (
    <div>
      <SectionHeader
        title="统计洞察"
        description="跨视频挖掘剪辑结构规律——点击时间线色块可查看每个镜头的推理轨迹"
        actions={
          <button
            onClick={() => {
              load()
              setReportKey((k) => k + 1)
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#2a2a42] px-3 py-1.5 text-sm text-[#8888a8] transition-all hover:border-[#35355a] hover:text-[#e8e8f0]"
          >
            <RefreshCw size={14} />
            重新挖掘
          </button>
        }
      />

      {!data || data.sample_size === 0 ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="暂无可分析的报告"
            description="先在基因库中分析至少一个视频，洞察会自动生成"
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 text-sm text-[#8888a8]">
            <Badge color="purple">样本 {data.sample_size} 条</Badge>
            <span>生成于 {data.generated_at?.slice(0, 19)}</span>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.insights.map((i) => (
              <Card key={i.dimension} className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-[#e8e8f0]">
                    {DIMENSION_LABELS[i.dimension] || i.dimension}
                  </span>
                  <Badge color={CONFIDENCE_BADGE[i.confidence] || 'gray'}>
                    {CONFIDENCE_LABEL[i.confidence] || i.confidence}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-[#a0a0c0]">{i.finding}</p>
                <p className="mt-2 text-xs text-[#5a5a7a]">样本 n={i.sample_size}</p>
              </Card>
            ))}
          </div>

          <iframe
            key={reportKey}
            src={reportUrl}
            title="洞察报告"
            className="h-[720px] w-full rounded-2xl border border-[#2a2a42] bg-white"
          />
        </>
      )}
    </div>
  )
}

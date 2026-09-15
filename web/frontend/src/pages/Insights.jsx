import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock3,
  Database,
  Film,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import api, { mediaUrl } from '../api.js'
import { Badge, Button, Card, EmptyState, InfoBar, SectionHeader } from '../components/ui.jsx'

const DIMENSION_LABELS = {
  hook: 'Hook 策略',
  rhythm: '节奏模式',
  shot_types: '镜头类型',
  emotion_arc: '情绪弧线',
  transitions: '转场使用',
}

const SHOT_LABELS = {
  hook: 'Hook',
  scene_establish: '场景建立',
  daily_moment: '日常叙事',
  persona_expression: '人物表达',
  emotion_peak: '情绪高潮',
  transition: '过渡',
  info_card: '信息卡',
  closing_moment: '收尾',
  cta: '行动引导',
  unknown: '未分类',
}

const SHOT_COLORS = {
  hook: '#f87171',
  scene_establish: '#00d4ff',
  daily_moment: '#7c5cfc',
  persona_expression: '#c084fc',
  emotion_peak: '#fbbf24',
  transition: '#66e0ff',
  info_card: '#34d399',
  closing_moment: '#5a5a7a',
  cta: '#fb7185',
  unknown: '#475569',
}

const CONFIDENCE_BADGE = { high: 'green', medium: 'amber', low: 'gray' }
const CONFIDENCE_LABEL = { high: '高置信', medium: '中置信', low: '样本不足' }

function formatSeconds(value) {
  return value > 0 ? `${Number(value).toFixed(1)}s` : '—'
}

function formatGeneratedAt(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 19) : date.toLocaleString('zh-CN')
}

function MetricCard({ icon: Icon, label, value, hint, color }) {
  return (
    <Card className="relative overflow-hidden p-4">
      <div
        className="absolute -right-7 -top-7 h-24 w-24 rounded-full opacity-10 blur-2xl"
        style={{ background: color }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#8888a8]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#e8e8f0]">{value}</p>
          <p className="mt-1 text-[11px] text-[#5a5a7a]">{hint}</p>
        </div>
        <span className="rounded-xl p-2.5" style={{ background: `${color}1f`, color }}>
          <Icon size={18} />
        </span>
      </div>
    </Card>
  )
}

function DistributionChart({ title, description, data, color = '#7c5cfc' }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, value]) => value), 1)
  const total = entries.reduce((sum, [, value]) => sum + value, 0)

  return (
    <Card className="p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-[#e8e8f0]">{title}</h3>
        <p className="mt-1 text-xs text-[#5a5a7a]">{description}</p>
      </div>
      {entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-[#5a5a7a]">暂无有效数据</div>
      ) : (
        <div className="space-y-3.5">
          {entries.slice(0, 8).map(([name, value]) => (
            <div key={name}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-[#a0a0c0]">{SHOT_LABELS[name] || name}</span>
                <span className="shrink-0 tabular-nums text-[#5a5a7a]">
                  {value} · {total ? Math.round((value / total) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#1c1c2b]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(value / max) * 100}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function ShotTimeline({ video, selectedIndex, onSelect }) {
  if (!video?.shots?.length) {
    return <div className="py-10 text-center text-sm text-[#5a5a7a]">暂无镜头时间数据</div>
  }

  return (
    <>
      <div className="flex h-16 gap-1 overflow-hidden rounded-xl border border-[#2a2a42] bg-[#0c0c14] p-1.5">
        {video.shots.map((shot) => {
          const color = SHOT_COLORS[shot.shot_type] || SHOT_COLORS.unknown
          const selected = selectedIndex === shot.index
          return (
            <button
              key={shot.index}
              onClick={() => onSelect(shot.index)}
              title={`镜头 ${shot.index + 1} · ${SHOT_LABELS[shot.shot_type] || shot.shot_type} · ${formatSeconds(shot.duration)}`}
              className="relative min-w-5 overflow-hidden rounded-lg transition-all hover:brightness-125"
              style={{
                flexGrow: Math.max(shot.duration || 0, 0.5),
                flexBasis: 0,
                background: `${color}${selected ? 'e6' : '66'}`,
                boxShadow: selected ? `inset 0 0 0 2px ${color}` : 'none',
              }}
            >
              <span className="absolute inset-x-0 bottom-1 text-center text-[9px] font-semibold text-white/80">
                {shot.index + 1}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {[...new Set(video.shots.map((shot) => shot.shot_type))].map((type) => (
          <span key={type} className="inline-flex items-center gap-1.5 text-[11px] text-[#8888a8]">
            <i className="h-2 w-2 rounded-sm" style={{ background: SHOT_COLORS[type] || SHOT_COLORS.unknown }} />
            {SHOT_LABELS[type] || type}
          </span>
        ))}
      </div>
    </>
  )
}

function EmotionFlow({ shots = [] }) {
  const emotions = shots.filter((shot) => shot.emotion)
  if (!emotions.length) return null

  return (
    <div className="mt-5 border-t border-[#2a2a42] pt-4">
      <p className="mb-3 text-xs font-medium text-[#8888a8]">情绪流</p>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {emotions.map((shot, index) => (
          <div key={shot.index} className="flex shrink-0 items-center gap-1">
            <span className="rounded-full bg-[rgba(124,92,252,0.12)] px-2.5 py-1 text-[11px] text-[#b49aff]">
              {shot.emotion}
            </span>
            {index < emotions.length - 1 && <span className="text-[#35355a]">→</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function VideoLibrary({ videos = [], onOpen, onAggregate }) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#e8e8f0]">已分析视频</h2>
          <p className="mt-1 text-xs text-[#6f6f91]">
            每个视频都有独立报告，点击卡片查看详细镜头分析
          </p>
        </div>
        <button
          onClick={onAggregate}
          className="inline-flex items-center gap-2 rounded-lg border border-[#35355a] bg-[#1c1c2b] px-3 py-2 text-xs font-medium text-[#b49aff] transition-colors hover:border-[#7c5cfc] hover:bg-[rgba(124,92,252,0.12)]"
        >
          查看综合统计
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => (
          <button
            key={video.id}
            onClick={() => onOpen(video.id)}
            className="group overflow-hidden rounded-2xl border border-[#2a2a42] bg-[#141421] text-left transition-all hover:-translate-y-0.5 hover:border-[#7c5cfc] hover:shadow-[0_12px_36px_rgba(0,0,0,0.24)]"
          >
            <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#27204b] via-[#17172b] to-[#0b0b12]">
              {video.cover_available ? (
                <img
                  src={mediaUrl(`/insights/videos/${video.id}/cover`)}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : video.media_available ? (
                <video
                  src={mediaUrl(`/insights/videos/${video.id}/media`)}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[#6f6f91]">
                  <ImageIcon size={34} strokeWidth={1.25} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-white/85">
                <span className="rounded-md bg-black/45 px-2 py-1">{formatSeconds(video.duration)}</span>
                <span className="rounded-md bg-black/45 px-2 py-1">{video.shot_count} 个镜头</span>
              </div>
              <span className="absolute right-3 top-3 rounded-full bg-[#7c5cfc] p-2 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                <ArrowRight size={15} />
              </span>
            </div>
            <div className="p-4">
              <h3 className="truncate text-sm font-semibold text-[#e8e8f0]">{video.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {video.structure_type && <Badge color="indigo">{video.structure_type}</Badge>}
                {video.hook_method && <Badge color="red">Hook · {video.hook_method}</Badge>}
                {video.overall_emotion && <Badge color="purple">{video.overall_emotion}</Badge>}
              </div>
              <p className="mt-3 text-xs text-[#6f6f91]">点击进入独立分析报告 →</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Insights() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedShotIndex, setSelectedShotIndex] = useState(0)
  const [viewMode, setViewMode] = useState('aggregate')
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/insights')
      if (currentRequest !== requestId.current) return
      setData(response.data)
      setSelectedVideoId(response.data.videos?.[0]?.id || '')
      setSelectedShotIndex(0)
      setViewMode('index')
    } catch (requestError) {
      if (currentRequest !== requestId.current) return
      setError(requestError.response?.data?.detail || '洞察数据加载失败，请稍后重试')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectedVideo = useMemo(
    () => data?.videos?.find((video) => video.id === selectedVideoId) || data?.videos?.[0],
    [data, selectedVideoId],
  )
  const selectedVideoReport = useMemo(
    () => data?.video_reports?.find((report) => report.video_id === selectedVideo?.id),
    [data, selectedVideo],
  )
  const isLibraryView = viewMode === 'index'
  const isAggregateView = viewMode === 'aggregate'
  const activeReport = isAggregateView ? data : (selectedVideoReport || data)
  const selectedShot = selectedVideo?.shots?.find((shot) => shot.index === selectedShotIndex)
  const shotInsight = activeReport?.insights?.find((insight) => insight.dimension === 'shot_types')
  const transitionInsight = activeReport?.insights?.find((insight) => insight.dimension === 'transitions')
  const rhythmInsight = activeReport?.insights?.find((insight) => insight.dimension === 'rhythm')
  const totalShots = isAggregateView
    ? data?.videos?.reduce((sum, video) => sum + video.shot_count, 0) || 0
    : selectedVideo?.shot_count || 0
  const durationVideos = isAggregateView
    ? data?.videos?.filter((video) => video.duration > 0) || []
    : selectedVideo?.duration > 0 ? [selectedVideo] : []
  const averageDuration = durationVideos.length
    ? durationVideos.reduce((sum, video) => sum + video.duration, 0) / durationVideos.length
    : 0
  const reportSampleSize = isAggregateView ? data?.sample_size : 1
  const overallConfidence = reportSampleSize >= 5 ? 'high' : reportSampleSize >= 2 ? 'medium' : 'low'
  const transitionData = transitionInsight?.data?.from_packaging
    && Object.keys(transitionInsight.data.from_packaging).length
    ? transitionInsight.data.from_packaging
    : transitionInsight?.data?.from_shot_config

  return (
    <div>
      <SectionHeader
        title="统计洞察"
        description="只从当前账号的基因分析中提炼结构规律"
        actions={
          <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={load}>
            重新挖掘
          </Button>
        }
      />

      {error && (
        <div className="mb-5">
          <InfoBar type="error">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <button onClick={load} className="font-medium text-[#fca5a5] underline underline-offset-4">
                重试
              </button>
            </div>
          </InfoBar>
        </div>
      )}

      {loading && !data ? (
        <div className="py-20 text-center text-sm text-[#5a5a7a]">正在扫描分析报告...</div>
      ) : !data || data.sample_size === 0 ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="还没有个人洞察"
            description="先在基因库完成至少一个视频分析；两个以上样本才能形成跨视频规律"
          >
            <Link to="/genes" className="text-sm font-medium text-[#66e0ff] hover:text-[#00d4ff]">
              去基因库分析视频 →
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <div className="vc-fade-in">
          <div className="mb-5 flex max-w-full gap-2 overflow-x-auto rounded-xl border border-[#2a2a42] bg-[#141421] p-1">
            <button
              onClick={() => setViewMode('index')}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isLibraryView
                  ? 'bg-[#7c5cfc] text-white'
                  : 'text-[#8888a8] hover:bg-[#1c1c2b] hover:text-[#c8c8e0]'
              }`}
            >
              视频库
            </button>
            <button
              onClick={() => setViewMode('aggregate')}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isAggregateView
                  ? 'bg-[#7c5cfc] text-white'
                  : 'text-[#8888a8] hover:bg-[#1c1c2b] hover:text-[#c8c8e0]'
              }`}
            >
              综合统计
            </button>
            {!isLibraryView && data.videos.map((video) => (
              <button
                key={video.id}
                onClick={() => {
                  setSelectedVideoId(video.id)
                  setSelectedShotIndex(video.shots?.[0]?.index || 0)
                  setViewMode(video.id)
                }}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === video.id
                    ? 'bg-[#7c5cfc] text-white'
                    : 'text-[#8888a8] hover:bg-[#1c1c2b] hover:text-[#c8c8e0]'
                }`}
                title={video.name}
              >
                {video.name}
              </button>
            ))}
          </div>

          {false && <div className="mb-5 inline-flex rounded-xl border border-[#2a2a42] bg-[#141421] p-1">
            <button
              onClick={() => setViewMode('video')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'video'
                  ? 'bg-[#7c5cfc] text-white'
                  : 'text-[#8888a8] hover:bg-[#1c1c2b] hover:text-[#c8c8e0]'
              }`}
            >
              单视频报告
            </button>
            <button
              onClick={() => setViewMode('aggregate')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'aggregate'
                  ? 'bg-[#7c5cfc] text-white'
                  : 'text-[#8888a8] hover:bg-[#1c1c2b] hover:text-[#c8c8e0]'
              }`}
            >
              综合统计
            </button>
          </div>}

          {viewMode === 'index' ? (
            <VideoLibrary
              videos={data.videos}
              onOpen={(videoId) => {
                setSelectedVideoId(videoId)
                const video = data.videos.find((item) => item.id === videoId)
                setSelectedShotIndex(video?.shots?.[0]?.index || 0)
                setViewMode(videoId)
              }}
              onAggregate={() => setViewMode('aggregate')}
            />
          ) : (
            <>
          {data.mode === 'single' && viewMode === 'aggregate' && (
            <div className="mb-5">
              <InfoBar type="warn">
                当前只有 1 个样本，下面展示单视频特征；至少积累 2 个视频后才会生成跨视频统计结论。
              </InfoBar>
            </div>
          )}

          {!isAggregateView && selectedVideo && (
            <div className="mb-4 rounded-xl border border-[rgba(124,92,252,0.24)] bg-[rgba(124,92,252,0.08)] px-4 py-3 text-sm text-[#c8c8e0]">
              当前独立报告：<span className="font-semibold text-[#e8e8f0]">{selectedVideo.name}</span>
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              icon={Database}
              label="有效样本"
              value={reportSampleSize}
              hint="仅当前账号"
              color="#7c5cfc"
            />
            <MetricCard icon={Film} label="镜头总数" value={totalShots} hint="已去重报告" color="#00d4ff" />
            <MetricCard
              icon={Clock3}
              label="平均视频时长"
              value={formatSeconds(averageDuration)}
              hint={`镜头中位数 ${formatSeconds(rhythmInsight?.data?.median_shot_duration || 0)}`}
              color="#34d399"
            />
            <MetricCard
              icon={Activity}
              label="统计置信度"
              value={CONFIDENCE_LABEL[overallConfidence]}
              hint={`更新于 ${formatGeneratedAt(data.generated_at)}`}
              color="#fbbf24"
            />
          </div>

          {viewMode === 'aggregate' && (
            <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {data.insights.map((insight) => (
                <Card key={insight.dimension} className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[#e8e8f0]">
                      {DIMENSION_LABELS[insight.dimension] || insight.dimension}
                    </span>
                    <Badge color={CONFIDENCE_BADGE[insight.confidence] || 'gray'}>
                      {CONFIDENCE_LABEL[insight.confidence] || insight.confidence}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-[#8888a8]">{insight.finding}</p>
                  <p className="mt-3 text-[11px] text-[#5a5a7a]">有效样本 n={insight.sample_size}</p>
                </Card>
              ))}
            </div>
          )}

          {!isAggregateView && selectedVideoReport && (
            <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {selectedVideoReport.insights.map((insight) => (
                <Card key={insight.dimension} className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[#e8e8f0]">
                      {DIMENSION_LABELS[insight.dimension] || insight.dimension}
                    </span>
                    <Badge color={CONFIDENCE_BADGE[insight.confidence] || 'gray'}>
                      {CONFIDENCE_LABEL[insight.confidence] || insight.confidence}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-[#8888a8]">{insight.finding}</p>
                  <p className="mt-3 text-[11px] text-[#5a5a7a]">当前视频 n=1</p>
                </Card>
              ))}
            </div>
          )}

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <DistributionChart
              title="镜头类型分布"
              description={`共统计 ${shotInsight?.data?.total_shots || 0} 个镜头`}
              data={shotInsight?.data?.overall}
              color="#7c5cfc"
            />
            <DistributionChart
              title="转场使用频次"
              description="优先采用包装分析结果，无数据时回退到逐镜头配置"
              data={transitionData}
              color="#00d4ff"
            />
          </div>

          <Card className="p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#e8e8f0]">逐视频结构</h3>
                <p className="mt-1 text-xs text-[#5a5a7a]">选择视频并点击时间线色块查看镜头依据</p>
              </div>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {data.videos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => {
                      setSelectedVideoId(video.id)
                      setSelectedShotIndex(video.shots?.[0]?.index || 0)
                      if (!isAggregateView) setViewMode(video.id)
                    }}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      selectedVideo?.id === video.id
                        ? 'border-[#7c5cfc] bg-[rgba(124,92,252,0.12)] text-[#b49aff]'
                        : 'border-[#2a2a42] bg-[#1c1c2b] text-[#8888a8] hover:border-[#35355a]'
                    }`}
                  >
                    {video.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedVideo && (
              <>
                <div className="mb-5 flex flex-wrap gap-2">
                  <Badge color="indigo">{selectedVideo.structure_type || '未标注结构'}</Badge>
                  <Badge color="blue">{selectedVideo.shot_count} 镜头</Badge>
                  <Badge color="green">{formatSeconds(selectedVideo.duration)}</Badge>
                  {selectedVideo.hook_method && <Badge color="red">Hook · {selectedVideo.hook_method}</Badge>}
                  {selectedVideo.overall_emotion && (
                    <Badge color="purple">情绪 · {selectedVideo.overall_emotion}</Badge>
                  )}
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0 rounded-xl border border-[#2a2a42] bg-[#101019] p-4">
                    <ShotTimeline
                      video={selectedVideo}
                      selectedIndex={selectedShotIndex}
                      onSelect={setSelectedShotIndex}
                    />
                    <EmotionFlow shots={selectedVideo.shots} />
                  </div>

                  <div className="rounded-xl border border-[#2a2a42] bg-[#1c1c2b] p-4">
                    {selectedShot ? (
                      <>
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-[#5a5a7a]">镜头 {selectedShot.index + 1}</p>
                            <p className="mt-1 text-sm font-semibold text-[#e8e8f0]">
                              {SHOT_LABELS[selectedShot.shot_type] || selectedShot.shot_type}
                            </p>
                          </div>
                          <Badge color="blue">{formatSeconds(selectedShot.duration)}</Badge>
                        </div>
                        <dl className="space-y-3 text-xs">
                          <div>
                            <dt className="text-[#5a5a7a]">时间范围</dt>
                            <dd className="mt-1 text-[#c8c8e0]">
                              {formatSeconds(selectedShot.start)} → {formatSeconds(selectedShot.end)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[#5a5a7a]">情绪 / 转场</dt>
                            <dd className="mt-1 text-[#c8c8e0]">
                              {selectedShot.emotion || '未标注'} · {selectedShot.transition || '无'}
                            </dd>
                          </div>
                          {(selectedShot.detail?.summary || selectedShot.detail?.visual) && (
                            <div>
                              <dt className="text-[#5a5a7a]">画面摘要</dt>
                              <dd className="mt-1 leading-relaxed text-[#c8c8e0]">
                                {selectedShot.detail.summary || selectedShot.detail.visual}
                              </dd>
                            </div>
                          )}
                          {selectedShot.detail?.reasoning && (
                            <div>
                              <dt className="text-[#5a5a7a]">结构判断依据</dt>
                              <dd className="mt-1 leading-relaxed text-[#c8c8e0]">
                                {selectedShot.detail.reasoning}
                              </dd>
                            </div>
                          )}
                        </dl>
                        <div className="mt-4 flex items-center gap-1.5 border-t border-[#2a2a42] pt-3 text-[11px] text-[#5a5a7a]">
                          <Sparkles size={12} />
                          {selectedShot.detail?.has_trace
                            ? `${selectedShot.detail.prompt_version || '分析轨迹'} · ${selectedShot.detail.model || '模型未记录'}`
                            : '历史数据未保存完整推理轨迹'}
                        </div>
                      </>
                    ) : (
                      <div className="py-10 text-center text-sm text-[#5a5a7a]">请选择一个镜头</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}

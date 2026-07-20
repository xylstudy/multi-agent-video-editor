import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen,
  Clapperboard,
  Dna,
  Loader2,
  Music,
  Scissors,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'
import { deleteGene, extractGeneKnowledge, getGene, mediaUrl } from '../api.js'
import {
  Badge,
  Button,
  Card,
  InfoBar,
  SectionHeader,
  StatusPill,
} from '../components/ui.jsx'

const PURPOSE_COLORS = {
  hook: 'red',
  人设展示: 'purple',
  场景铺展: 'blue',
  情绪递进: 'indigo',
  高潮爆发: 'amber',
  价值输出: 'green',
  CTA互动: 'blue',
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
      <Icon size={16} className="text-[#b49aff]" />
      {children}
    </h2>
  )
}

function ReportRow({ label, children }) {
  return (
    <div className="flex gap-3 py-2 text-sm">
      <span className="w-24 shrink-0 text-[#5a5a7a]">{label}</span>
      <span className="text-[#c8c8e0]">{children || '—'}</span>
    </div>
  )
}

/* 节奏曲线（纯 CSS 柱状图） */
function RhythmChart({ points = [] }) {
  if (!points.length) return null
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{ height: 120 }}>
      {points.map((p, i) => (
        <div key={i} className="group flex min-w-[34px] flex-1 flex-col items-center justify-end">
          <div className="relative w-full">
            <div
              className="w-full rounded-t bg-gradient-to-t from-[#7c5cfc] to-[#00d4ff] opacity-80 transition-opacity group-hover:opacity-100"
              style={{ height: `${Math.max(6, (p.intensity || 0) * 88)}px` }}
              title={p.note || ''}
            />
          </div>
          <span className="mt-1.5 text-[10px] text-[#5a5a7a]">{(p.time || 0).toFixed(0)}s</span>
        </div>
      ))}
    </div>
  )
}

export default function GeneDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [gene, setGene] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState(null)

  useEffect(() => {
    getGene(id).then((res) => setGene(res.data)).catch(() => navigate('/genes'))
  }, [id])

  // 分析中轮询
  useEffect(() => {
    if (!gene || gene.status === 'done' || gene.status === 'failed') return
    const timer = setInterval(() => {
      getGene(id).then((res) => setGene(res.data)).catch(() => {})
    }, 3000)
    return () => clearInterval(timer)
  }, [gene?.status, id])

  const handleExtract = async () => {
    setExtracting(true)
    setExtractMsg(null)
    try {
      const res = await extractGeneKnowledge(id)
      setExtractMsg({ type: 'success', text: `已提炼 ${res.data.added} 条知识，沉淀到知识库` })
    } catch (err) {
      setExtractMsg({ type: 'error', text: err.response?.data?.detail || '提炼失败' })
    } finally {
      setExtracting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定删除该基因？')) return
    await deleteGene(id)
    navigate('/genes')
  }

  if (!gene) {
    return <div className="py-16 text-center text-sm text-[#5a5a7a]">加载中...</div>
  }

  const report = gene.report
  const sa = report?.raw_structure_analysis || {}
  const meta = report?.vlog_meta || {}
  const hook = sa.hook_strategy || {}
  const rhythm = sa.rhythm_analysis || {}
  const packaging = sa.packaging_analysis || {}
  const st = sa.structure_type || {}

  return (
    <div>
      <SectionHeader
        title={gene.title}
        description={gene.source_filename}
        actions={
          <>
            {gene.status === 'done' && (
              <>
                <Button variant="secondary" icon={BookOpen} loading={extracting} onClick={handleExtract}>
                  提炼知识入库
                </Button>
                <Button icon={Sparkles} onClick={() => navigate(`/projects?gene=${gene.id}`)}>
                  用此基因创建项目
                </Button>
              </>
            )}
            <Button variant="danger" icon={Trash2} onClick={handleDelete}>
              删除
            </Button>
          </>
        }
      />

      {extractMsg && (
        <div className="mb-6 vc-fade-in">
          <InfoBar type={extractMsg.type}>
            {extractMsg.text}
            {extractMsg.type === 'success' && (
              <button
                className="ml-2 underline"
                onClick={() => navigate('/knowledge')}
              >
                去知识库看看 →
              </button>
            )}
          </InfoBar>
        </div>
      )}

      {/* 分析中 / 失败状态 */}
      {gene.status !== 'done' && (
        <Card className="mb-6 flex items-center gap-4 p-6">
          {gene.status === 'failed' ? (
            <InfoBar type="error">{gene.error_message || '提取失败'}</InfoBar>
          ) : (
            <>
              <Loader2 size={20} className="animate-spin text-[#66e0ff]" />
              <div>
                <p className="text-sm font-medium text-[#e8e8f0]">正在提取视频基因...</p>
                <p className="mt-0.5 text-xs text-[#5a5a7a]">
                  逐镜头分析通常需要几分钟，页面会自动刷新
                </p>
              </div>
            </>
          )}
        </Card>
      )}

      {/* 视频预览 */}
      <Card className="mb-6 p-5">
        <SectionTitle icon={Clapperboard}>源视频</SectionTitle>
        <div className="overflow-hidden rounded-xl bg-black">
          <video src={mediaUrl(`/genes/${gene.id}/video`)} controls className="max-h-[420px] w-full" />
        </div>
      </Card>

      {report && (
        <>
          {/* 基因概览 */}
          <Card className="mb-6 p-5">
            <SectionTitle icon={Dna}>基因概览</SectionTitle>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {st.category && <Badge color="indigo">{st.category}</Badge>}
              {meta.narrative_type && <Badge color="blue">叙事: {meta.narrative_type}</Badge>}
              {sa.persona_type && <Badge color="purple">人设: {sa.persona_type}</Badge>}
              {sa.overall_emotion && <Badge color="green">情绪: {sa.overall_emotion}</Badge>}
              <Badge color="gray">{report.duration?.toFixed(1)}s</Badge>
              <Badge color="gray">{report.shot_count} 镜头</Badge>
              {report.resolution && <Badge color="gray">{report.resolution.join('×')}</Badge>}
            </div>
            {sa.overall_summary && (
              <p className="text-sm leading-relaxed text-[#c8c8e0]">{sa.overall_summary}</p>
            )}
            {st.core_characteristics && (
              <p className="mt-2 text-xs leading-relaxed text-[#8888a8]">
                结构特征：{st.core_characteristics}
              </p>
            )}
          </Card>

          {/* Hook 策略 */}
          <Card className="mb-6 p-5">
            <SectionTitle icon={Zap}>前 3 秒 Hook 策略</SectionTitle>
            <div className="divide-y divide-[#2a2a42]">
              <ReportRow label="方法">{hook.method}</ReportRow>
              <ReportRow label="具体手法">{hook.detail || report.hook_summary}</ReportRow>
              <ReportRow label="效果评估">{hook.effectiveness}</ReportRow>
              <ReportRow label="与正文衔接">{hook.connection_to_body}</ReportRow>
            </div>
          </Card>

          {/* 段落结构 */}
          {sa.script_structure?.length > 0 && (
            <Card className="mb-6 p-5">
              <SectionTitle icon={Scissors}>脚本段落结构</SectionTitle>
              <div className="space-y-3">
                {sa.script_structure.map((seg) => (
                  <div
                    key={seg.index}
                    className="rounded-xl border border-[#2a2a42] bg-[#1c1c2b] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[#5a5a7a]">#{seg.index}</span>
                      <Badge color={PURPOSE_COLORS[seg.purpose] || 'indigo'}>{seg.purpose}</Badge>
                      <span className="text-xs text-[#8888a8]">{seg.shot_range}</span>
                      <span className="ml-auto text-xs text-[#5a5a7a]">
                        {seg.emotion} · 节奏{seg.rhythm}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#c8c8e0]">{seg.content_summary}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 节奏分析 */}
          {rhythm.curve_points?.length > 0 && (
            <Card className="mb-6 p-5">
              <SectionTitle icon={Music}>节奏曲线</SectionTitle>
              <RhythmChart points={rhythm.curve_points} />
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#8888a8]">
                {rhythm.pattern && <span>模式: {rhythm.pattern}</span>}
                {rhythm.estimated_bpm_range && <span>BPM: {rhythm.estimated_bpm_range}</span>}
                {rhythm.bgm_style_guess && <span>BGM: {rhythm.bgm_style_guess}</span>}
                {rhythm.climax_position_percent != null && (
                  <span>高潮位置: {rhythm.climax_position_percent}%</span>
                )}
                {rhythm.front_3s_shot_count != null && (
                  <span>前 3 秒: {rhythm.front_3s_shot_count} 个镜头</span>
                )}
              </div>
            </Card>
          )}

          {/* 包装分析 + 关键技法 */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <SectionTitle icon={Scissors}>包装风格</SectionTitle>
              <div className="divide-y divide-[#2a2a42]">
                <ReportRow label="字幕样式">
                  {packaging.subtitle_font_guess}
                  {packaging.subtitle_color_and_stroke
                    ? ` · ${packaging.subtitle_color_and_stroke}`
                    : ''}
                </ReportRow>
                <ReportRow label="字幕动效">{packaging.subtitle_animation}</ReportRow>
                <ReportRow label="调色风格">
                  {packaging.color_grade}
                  {packaging.color_grade_detail ? ` · ${packaging.color_grade_detail}` : ''}
                </ReportRow>
                <ReportRow label="转场习惯">
                  {packaging.transitions_used?.length
                    ? packaging.transitions_used.map((t) => t.type).filter(Boolean).join('、')
                    : '—'}
                </ReportRow>
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle icon={Sparkles}>关键技法</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {(report.key_techniques || []).map((t, i) => (
                  <Badge key={i} color="indigo">{t}</Badge>
                ))}
                {(!report.key_techniques || report.key_techniques.length === 0) && (
                  <span className="text-sm text-[#5a5a7a]">—</span>
                )}
              </div>
            </Card>
          </div>

          {/* 逐镜头标注 */}
          {report.shots?.length > 0 && (
            <Card className="p-5">
              <SectionTitle icon={Clapperboard}>逐镜头功能标注（{report.shots.length} 个镜头）</SectionTitle>
              <ul className="divide-y divide-[#2a2a42]">
                {report.shots.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 py-2.5">
                    <span className="mt-0.5 w-8 shrink-0 text-xs font-bold text-[#5a5a7a]">
                      {(s.index ?? i) + 1}
                    </span>
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <Badge color="blue">{s.shot_type || 'unknown'}</Badge>
                      {s.emotion && <Badge color="green">{s.emotion}</Badge>}
                      {s.has_face && <Badge color="purple">人脸</Badge>}
                      <span className="text-sm text-[#c8c8e0]">{s.visual_description}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

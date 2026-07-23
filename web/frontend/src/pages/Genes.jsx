import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dna, FileVideo, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { createGene, deleteGene, listGenes } from '../api.js'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InfoBar,
  ProgressBar,
  SectionHeader,
  StatusPill,
  TextInput,
} from '../components/ui.jsx'

const GENE_STATUS = {
  pending: '排队中',
  analyzing: '分析中',
  done: '已完成',
  failed: '失败',
}

/* 从进度日志推导当前阶段的可读描述（用于分析中的卡片） */
const STAGE_LABELS = {
  video_info: '读取视频信息',
  scenes: '镜头切分',
  audio: '音频处理',
  shot_start: '逐镜头分析',
  shot_result: '逐镜头分析',
  shot_failed: '逐镜头分析',
  structure_start: '全局结构分析',
  structure_done: '全局结构分析',
  done: '收尾',
}

function latestStageLabel(g) {
  const events = (g.progress_logs || []).filter((l) => l.type !== 'log')
  if (!events.length) return '正在启动分析...'
  const last = events[events.length - 1]
  if (last.type === 'shot_start' || last.type === 'shot_result' || last.type === 'shot_failed') {
    const d = last.data || {}
    const done = last.type === 'shot_start' ? (d.index ?? 0) : (d.index ?? 0) + 1
    return `逐镜头分析 ${done}/${d.total ?? '?'}`
  }
  return STAGE_LABELS[last.type] || '分析中'
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Genes() {
  const [genes, setGenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const fetchGenes = async () => {
    try {
      const res = await listGenes()
      setGenes(res.data)
      return res.data
    } finally {
      setLoading(false)
    }
  }

  // 有基因处于分析中 → 每 3 秒轮询
  useEffect(() => {
    fetchGenes()
  }, [])

  useEffect(() => {
    const hasActive = genes.some((g) => g.status === 'pending' || g.status === 'analyzing')
    if (!hasActive) return
    const timer = setInterval(fetchGenes, 3000)
    return () => clearInterval(timer)
  }, [genes])

  const submit = async (useSample) => {
    setError('')
    if (!useSample && !file) {
      setError('请选择视频文件，或改用示例视频')
      return
    }
    if (!title.trim()) {
      setError('请填写视频名称')
      return
    }
    setCreating(true)
    try {
      await createGene(title.trim(), useSample ? null : file, useSample)
      setTitle('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setShowCreate(false)
      fetchGenes()
    } catch (err) {
      setError(err.response?.data?.detail || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('确定删除该基因？')) return
    await deleteGene(id)
    fetchGenes()
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#5a5a7a]">加载中...</div>
  }

  return (
    <div>
      <SectionHeader
        title="视频基因库"
        description="上传爆款视频，引擎自动拆解它的结构基因 —— 分析过的视频可直接作为项目参考"
        actions={
          <Button icon={Plus} onClick={() => setShowCreate((v) => !v)}>
            提取新基因
          </Button>
        }
      />

      {showCreate && (
        <Card className="mb-6 p-5 vc-fade-in">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Dna size={16} className="text-[#66e0ff]" />
            提取视频基因
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="视频名称" className="min-w-[200px] flex-1">
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：北京旅行爆款 Vlog"
              />
            </Field>
            <Field label="视频文件" className="min-w-[220px]">
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files[0] || null)}
                className="w-full rounded-lg border border-[#2a2a42] bg-[#1c1c2b] px-3 py-1.5 text-sm text-[#8888a8] file:mr-3 file:rounded-md file:border-0 file:bg-[#2a2a42] file:px-3 file:py-1.5 file:text-xs file:text-[#c8c8e0] hover:file:bg-[#35355a]"
              />
            </Field>
            <div className="flex gap-2">
              <Button loading={creating} onClick={() => submit(false)}>
                开始提取
              </Button>
              <Button
                variant="secondary"
                icon={Sparkles}
                loading={creating}
                onClick={() => submit(true)}
              >
                用示例视频
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                取消
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#5a5a7a]">
            提取过程需要调用多模态大模型逐镜头分析，通常需要几分钟，期间可离开本页
          </p>
          {error && (
            <div className="mt-4">
              <InfoBar type="error">{error}</InfoBar>
            </div>
          )}
        </Card>
      )}

      {genes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Dna}
            title="还没有视频基因"
            description="上传一条爆款视频，或直接用示例视频体验基因提取"
          >
            <Button icon={Plus} onClick={() => setShowCreate(true)}>
              提取第一个基因
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {genes.map((g) => (
            <Link key={g.id} to={`/genes/${g.id}`} className="block">
              <Card hover className="group relative h-full p-5">
                <button
                  onClick={(e) => handleDelete(e, g.id)}
                  title="删除基因"
                  className="absolute right-3 top-3 rounded-lg p-1.5 text-[#5a5a7a] opacity-0 transition-all hover:bg-[rgba(248,113,113,0.08)] hover:text-[#f87171] group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>

                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,212,255,0.1)]">
                    {g.status === 'analyzing' || g.status === 'pending' ? (
                      <Loader2 size={18} className="animate-spin text-[#66e0ff]" />
                    ) : (
                      <FileVideo size={18} className="text-[#66e0ff]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate pr-6 text-sm font-semibold text-[#e8e8f0] group-hover:text-[#66e0ff] transition-colors">
                      {g.title}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-[#5a5a7a]">{g.source_filename}</p>
                  </div>
                </div>

                {g.status === 'done' ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {g.structure_type && <Badge color="indigo">{g.structure_type}</Badge>}
                    {g.hook_method && <Badge color="blue">Hook: {g.hook_method}</Badge>}
                    {g.overall_emotion && <Badge color="green">{g.overall_emotion}</Badge>}
                  </div>
                ) : g.status === 'failed' ? (
                  <p className="mt-4 line-clamp-2 text-xs text-[#fca5a5]">{g.error_message}</p>
                ) : (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-[#8888a8]">{latestStageLabel(g)}</span>
                      <span className="text-[#5a5a7a]">{g.progress || 0}%</span>
                    </div>
                    <ProgressBar value={g.progress || 0} />
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-[#2a2a42] pt-3">
                  <span className="text-xs text-[#5a5a7a]">
                    {g.status === 'done'
                      ? `${g.duration.toFixed(0)}s · ${g.shot_count} 个镜头`
                      : GENE_STATUS[g.status] || g.status}
                  </span>
                  <span className="text-xs text-[#5a5a7a]">{formatDate(g.created_at)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

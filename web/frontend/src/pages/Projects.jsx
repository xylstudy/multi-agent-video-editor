import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FolderOpen, Plus, Sparkles, Trash2 } from 'lucide-react'
import { createProject, deleteProject, listGenes, listProjects } from '../api.js'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InfoBar,
  SectionHeader,
  SelectInput,
  TextInput,
} from '../components/ui.jsx'

const MODE_META = {
  editing_transfer: { label: '编辑迁移', color: 'purple' },
  agent_pipeline: { label: '多智能体', color: 'blue' },
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [genes, setGenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [mode, setMode] = useState('editing_transfer')
  const [geneId, setGeneId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()

  const fetchProjects = async () => {
    try {
      const res = await listProjects()
      setProjects(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
    listGenes().then((res) => {
      const done = res.data.filter((g) => g.status === 'done')
      setGenes(done)
      // 从基因详情页带过来的预选
      const preselect = searchParams.get('gene')
      if (preselect && done.some((g) => String(g.id) === preselect)) {
        setGeneId(preselect)
        setShowCreate(true)
      }
    })
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await createProject({
        name,
        topic,
        pipeline_mode: mode,
        gene_id: geneId ? Number(geneId) : null,
      })
      setName('')
      setTopic('')
      setGeneId('')
      setShowCreate(false)
      fetchProjects()
    } catch (err) {
      setError(err.response?.data?.detail || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('确定删除该项目？项目下的素材和任务也会一并删除。')) return
    await deleteProject(id)
    fetchProjects()
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#5a5a7a]">加载中...</div>
  }

  return (
    <div>
      <SectionHeader
        title="我的项目"
        description="每个项目对应一条要生成的 Vlog：上传参考视频和照片，即可复刻爆款结构"
        actions={
          <Button icon={Plus} onClick={() => setShowCreate((v) => !v)}>
            新建项目
          </Button>
        }
      />

      {showCreate && (
        <Card className="mb-6 p-5 vc-fade-in">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles size={16} className="text-[#b49aff]" />
            创建新项目
          </h2>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
            <Field label="项目名称" className="min-w-[200px] flex-1">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：北京旅行 Vlog"
                required
              />
            </Field>
            <Field label="主题" className="min-w-[200px] flex-1">
              <TextInput
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：北京旅行"
              />
            </Field>
            <Field
              label="流水线模式"
              hint={mode === 'editing_transfer' ? '复刻爆款剪辑节奏，速度快' : '多智能体协作生成，效果更好'}
              className="min-w-[220px]"
            >
              <SelectInput value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="editing_transfer">编辑迁移</option>
                <option value="agent_pipeline">多智能体流水线</option>
              </SelectInput>
            </Field>
            <Field
              label="参考视频"
              hint={geneId ? '将从基因库复制该视频到项目素材' : '创建后在项目内上传'}
              className="min-w-[220px]"
            >
              <SelectInput value={geneId} onChange={(e) => setGeneId(e.target.value)}>
                <option value="">稍后手动上传</option>
                {genes.map((g) => (
                  <option key={g.id} value={g.id}>
                    基因：{g.title}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={creating}>
                创建
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                取消
              </Button>
            </div>
          </form>
          {error && (
            <div className="mt-4">
              <InfoBar type="error">{error}</InfoBar>
            </div>
          )}
        </Card>
      )}

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderOpen}
            title="暂无项目"
            description="创建一个项目，上传参考视频和照片，开始生成 Vlog"
          >
            <Button icon={Plus} onClick={() => setShowCreate(true)}>
              新建项目
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => {
            const meta = MODE_META[p.pipeline_mode] || MODE_META.editing_transfer
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="block">
                <Card hover className="group relative h-full p-5">
                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    title="删除项目"
                    className="absolute right-3 top-3 rounded-lg p-1.5 text-[#5a5a7a] opacity-0 transition-all hover:bg-[rgba(248,113,113,0.08)] hover:text-[#f87171] group-hover:opacity-100"
                  >
                    <Trash2 size={15} />
                  </button>
                  <h3 className="pr-8 text-sm font-semibold text-[#e8e8f0] group-hover:text-[#b49aff] transition-colors">
                    {p.name}
                  </h3>
                  <p className="mt-1 truncate text-sm text-[#5a5a7a]">
                    {p.topic || '未设置主题'}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge color={meta.color}>{meta.label}</Badge>
                    <span className="text-xs text-[#5a5a7a]">{formatDate(p.created_at)}</span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

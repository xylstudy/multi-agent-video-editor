import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clapperboard,
  Dna,
  FolderOpen,
  PlaySquare,
  Sparkles,
  Upload,
} from 'lucide-react'
import { getStats } from '../api.js'
import { Button, Card, SectionHeader, StatusPill } from '../components/ui.jsx'

const STAT_CARDS = [
  { key: 'projects', label: '我的项目', icon: FolderOpen, to: '/projects', color: 'text-[#b49aff]', bg: 'bg-[rgba(124,92,252,0.12)]' },
  { key: 'genes', label: '视频基因', icon: Dna, to: '/genes', color: 'text-[#66e0ff]', bg: 'bg-[rgba(0,212,255,0.12)]' },
  { key: 'knowledge', label: '我的知识', icon: BookOpen, to: '/knowledge', color: 'text-[#6ee7b7]', bg: 'bg-[rgba(52,211,153,0.12)]' },
  { key: 'works', label: '生成成片', icon: PlaySquare, to: '/works', color: 'text-[#fcd34d]', bg: 'bg-[rgba(251,191,36,0.12)]' },
]

const GUIDE_STEPS = [
  {
    icon: Dna,
    title: '① 提取爆款基因',
    desc: '上传一条爆款 Vlog，引擎自动拆解它的 Hook、节奏、段落和剪辑技法',
    to: '/genes',
    action: '去提取',
  },
  {
    icon: Clapperboard,
    title: '② 创建项目',
    desc: '选用基因库里的参考视频，上传你的照片素材，一键复刻结构',
    to: '/projects',
    action: '去创建',
  },
  {
    icon: PlaySquare,
    title: '③ 收获成片',
    desc: '实时查看生成进度，成片自动收入作品集，随时播放下载',
    to: '/works',
    action: '去看看',
  },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getStats()
      .then((res) => setStats(res.data))
      .catch(() => setStats({ projects: 0, genes: 0, knowledge: 0, works: 0, recent_tasks: [] }))
  }, [])

  if (!stats) {
    return <div className="py-16 text-center text-sm text-[#5a5a7a]">加载中...</div>
  }

  const isEmpty = stats.projects === 0 && stats.genes === 0 && stats.works === 0

  return (
    <div>
      <SectionHeader
        title="工作台"
        description="拆解爆款结构，复刻到你的素材上 —— 从基因提取到成片产出的完整流水线"
        actions={
          <>
            <Button variant="secondary" icon={Upload} onClick={() => navigate('/genes')}>
              提取视频基因
            </Button>
            <Button icon={Sparkles} onClick={() => navigate('/projects')}>
              新建项目
            </Button>
          </>
        }
      />

      {/* 统计卡片 */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, to, color, bg }) => (
          <Link key={key} to={to}>
            <Card hover className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg}`}>
                <Icon size={20} className={color} />
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">{stats[key]}</div>
                <div className="text-xs text-[#8888a8]">{label}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* 新手引导（空状态时展示） */}
      {isEmpty && (
        <Card className="mb-6 p-6 vc-fade-in">
          <h2 className="mb-1 text-sm font-semibold text-white">三步生成你的第一条 Vlog</h2>
          <p className="mb-5 text-sm text-[#5a5a7a]">
            引擎已经把 50+ 条爆款剪辑技法沉淀在知识库里，你只需要提供参考视频和素材
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {GUIDE_STEPS.map(({ icon: Icon, title, desc, to, action }) => (
              <div
                key={title}
                className="rounded-xl border border-[#2a2a42] bg-[#1c1c2b] p-4"
              >
                <Icon size={20} className="text-[#b49aff]" />
                <h3 className="mt-3 text-sm font-medium text-[#e8e8f0]">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#8888a8]">{desc}</p>
                <button
                  onClick={() => navigate(to)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#66e0ff] hover:text-[#00d4ff]"
                >
                  {action}
                  <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 最近任务 */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">最近任务</h2>
          <Link
            to="/projects"
            className="flex items-center gap-1 text-xs text-[#8888a8] hover:text-[#b49aff]"
          >
            全部项目
            <ChevronRight size={13} />
          </Link>
        </div>
        {stats.recent_tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#5a5a7a]">
            还没有任务记录，从上方任意一步开始吧
          </p>
        ) : (
          <ul className="divide-y divide-[#2a2a42]">
            {stats.recent_tasks.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => navigate(`/tasks/${t.id}`)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-sm font-medium text-[#e8e8f0]">#{t.id}</span>
                    <span className="truncate text-sm text-[#8888a8]">{t.project_name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-[#5a5a7a]">{t.progress}%</span>
                    <StatusPill status={t.status} />
                    <ChevronRight size={14} className="text-[#5a5a7a]" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

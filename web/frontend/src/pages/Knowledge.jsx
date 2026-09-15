import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Library, PlayCircle, Search, Trash2, UserRound } from 'lucide-react'
import { deleteKnowledge, listKnowledge, mediaUrl } from '../api.js'
import { Badge, Card, EmptyState, SectionHeader, TextInput } from '../components/ui.jsx'

const TYPE_TABS = [
  { key: '', label: '全部' },
  { key: 'transition_type', label: '转场' },
  { key: 'editing_technique', label: '剪辑技法' },
  { key: 'packaging_style', label: '包装风格' },
  { key: 'effect_type', label: '特效' },
  { key: 'structure_template', label: '结构模板' },
  { key: 'hook_technique', label: 'Hook 技法' },
  { key: 'rhythm_pattern', label: '节奏模式' },
  { key: 'emotion_design', label: '情绪设计' },
]

const TYPE_BADGE = {
  transition_type: 'blue',
  editing_technique: 'indigo',
  packaging_style: 'purple',
  effect_type: 'amber',
  structure_template: 'green',
  hook_technique: 'red',
  rhythm_pattern: 'blue',
  emotion_design: 'green',
}

const TYPE_LABEL = Object.fromEntries(TYPE_TABS.filter((t) => t.key).map((t) => [t.key, t.label]))

const SOURCE_TABS = [
  { key: 'mine', label: '我的知识', icon: UserRound },
  { key: 'system', label: '系统技法', icon: Library },
]

/** 技法演示播放器：默认收起，点击后加载视频（避免整页同时加载几十个视频） */
function DemoPlayer({ id }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-[#2a2a42] bg-[rgba(124,92,252,0.08)] px-3 py-2 text-xs font-medium text-[#b49aff] transition-colors hover:bg-[rgba(124,92,252,0.16)]"
      >
        <PlayCircle size={14} />
        播放演示
      </button>
    )
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg bg-black">
      <video
        src={mediaUrl(`/knowledge/${encodeURIComponent(id)}/demo`)}
        controls
        autoPlay
        loop
        className="max-h-72 w-full object-contain"
      />
    </div>
  )
}

export default function Knowledge() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('mine')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listKnowledge({ scope, ...(type ? { type } : {}), ...(q ? { q } : {}) })
      setEntries(res.data)
    } finally {
      setLoading(false)
    }
  }, [q, scope, type])

  // 类型切换立即刷新；搜索输入做 350ms 防抖。
  useEffect(() => {
    const timer = setTimeout(fetchEntries, q ? 350 : 0)
    return () => clearTimeout(timer)
  }, [fetchEntries, q])

  const handleDelete = async (id) => {
    if (!confirm('确定删除该知识条目？')) return
    await deleteKnowledge(id)
    fetchEntries()
  }

  const handleScopeChange = (nextScope) => {
    setScope(nextScope)
    setType('')
    setQ('')
  }

  const hasFilters = Boolean(type || q)
  const emptyTitle = hasFilters
    ? '没有匹配的知识条目'
    : scope === 'mine'
      ? '还没有个人知识'
      : '暂无系统技法'
  const emptyDescription = hasFilters
    ? '换个类型或关键词试试'
    : scope === 'mine'
      ? '去基因库提炼知识后，它们会出现在这里'
      : '系统暂未配置内置剪辑技法'

  return (
    <div>
      <SectionHeader
        title="知识库"
        description="个人提炼的经验与系统内置技法分开管理，生成视频时按需使用"
      />

      <div className="mb-4 inline-flex rounded-xl border border-[#2a2a42] bg-[#141421] p-1">
        {SOURCE_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleScopeChange(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              scope === key
                ? 'bg-[#7c5cfc] text-white'
                : 'text-[#8888a8] hover:bg-[#1c1c2b] hover:text-[#c8c8e0]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* 类型 Tab + 搜索 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                type === t.key
                  ? 'bg-[#7c5cfc] text-white'
                  : 'bg-[#1c1c2b] text-[#8888a8] hover:bg-[#24243a] hover:text-[#c8c8e0]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a7a]" />
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索标题 / 内容 / 标签"
            className="pl-8"
            style={{ paddingLeft: '2rem' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[#5a5a7a]">加载中...</div>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={emptyTitle}
            description={emptyDescription}
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-[#5a5a7a]">共 {entries.length} 条</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => (
              <Card key={e.id} hover className="group relative flex flex-col p-4">
                {e.mine && (
                  <button
                    onClick={() => handleDelete(e.id)}
                    title="删除"
                    className="absolute right-3 top-3 rounded-lg p-1 text-[#5a5a7a] opacity-0 transition-all hover:bg-[rgba(248,113,113,0.08)] hover:text-[#f87171] group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <div className="mb-2 flex items-center gap-2">
                  <Badge color={TYPE_BADGE[e.type] || 'gray'}>
                    {TYPE_LABEL[e.type] || e.type}
                  </Badge>
                  <Badge color={e.source === 'user' ? 'green' : 'gray'}>
                    {e.source === 'user' ? '我的' : '系统'}
                  </Badge>
                </div>
                <h3 className="pr-6 text-sm font-semibold text-[#e8e8f0]">{e.title}</h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-[#8888a8]">
                  {e.content}
                </p>
                {e.source_summary && e.source === 'user' && (
                  <p className="mt-2 text-[11px] text-[#6f6f91]">
                    来源：{e.source_summary}
                  </p>
                )}
                {e.has_demo && <DemoPlayer id={e.id} />}
                {e.best_when && (
                  <p className="mt-2 text-xs text-[#5a5a7a]">
                    <span className="font-medium text-[#8888a8]">适用：</span>
                    {e.best_when}
                  </p>
                )}
                {e.tags?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-[#2a2a42] pt-2.5">
                    {e.tags.slice(0, 5).map((t, i) => (
                      <span
                        key={i}
                        className="rounded bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[10px] text-[#5a5a7a]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

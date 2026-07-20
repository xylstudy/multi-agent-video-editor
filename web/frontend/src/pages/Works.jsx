import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, PlaySquare } from 'lucide-react'
import { listWorks, mediaUrl } from '../api.js'
import { Badge, Button, Card, EmptyState, SectionHeader } from '../components/ui.jsx'

const MODE_LABEL = {
  editing_transfer: '编辑迁移',
  agent_pipeline: '多智能体',
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Works() {
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listWorks()
      .then((res) => setWorks(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#5a5a7a]">加载中...</div>
  }

  return (
    <div>
      <SectionHeader
        title="作品集"
        description="所有项目生成的成片都汇集在这里，随时播放和下载"
      />

      {works.length === 0 ? (
        <Card>
          <EmptyState
            icon={PlaySquare}
            title="还没有成片"
            description="去项目页运行一次端到端生成，成片会自动出现在这里"
          >
            <Link to="/projects">
              <Button>去创建项目</Button>
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {works.map((w) => (
            <Card key={w.task_id} className="overflow-hidden">
              <div className="bg-black">
                <video
                  src={mediaUrl(`/tasks/${w.task_id}/download`)}
                  controls
                  preload="metadata"
                  className="max-h-[300px] w-full"
                />
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/tasks/${w.task_id}`}
                      className="truncate text-sm font-medium text-[#e8e8f0] hover:text-[#b49aff]"
                    >
                      {w.project_name || `任务 #${w.task_id}`}
                    </Link>
                    <Badge color="indigo">{MODE_LABEL[w.pipeline_mode] || w.pipeline_mode}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[#5a5a7a]">
                    任务 #{w.task_id} · {w.size_mb}MB · {formatDate(w.created_at)}
                  </p>
                </div>
                <a href={mediaUrl(`/tasks/${w.task_id}/download`)} download>
                  <Button variant="secondary" size="sm" icon={Download}>
                    下载
                  </Button>
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

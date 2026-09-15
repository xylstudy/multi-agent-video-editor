import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bot, Download, Trash2 } from 'lucide-react'
import { deleteTask, downloadTaskResult, getStoryboard, getTask, mediaUrl } from '../api.js'
import {
  Button,
  Card,
  InfoBar,
  ProgressBar,
  SectionHeader,
  StatusPill,
} from '../components/ui.jsx'
import StepTimeline from '../components/StepTimeline.jsx'
import LogTerminal from '../components/LogTerminal.jsx'
import StoryboardEditor from '../components/StoryboardEditor.jsx'

const TASK_TYPE_LABELS = {
  end_to_end: '端到端生成',
  material_analysis: '素材分析',
  analyze_video: '视频结构分析',
}

function WsDot({ status }) {
  const meta = {
    connected:    { color: 'bg-[#34d399]', label: '实时连接已建立' },
    connecting:   { color: 'bg-[#fbbf24] vc-pulse-dot', label: '连接中...' },
    disconnected: { color: 'bg-[#5a5a7a]', label: '连接已断开' },
    error:       { color: 'bg-[#f87171]', label: '连接异常' },
  }[status] || { color: 'bg-[#5a5a7a]', label: status }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#8888a8]">
      <span className={`h-1.5 w-1.5 rounded-full ${meta.color}`} />
      {meta.label}
    </span>
  )
}

export default function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [logs, setLogs] = useState([])
  const [draft, setDraft] = useState(null)
  const [draftError, setDraftError] = useState('')
  const [wsStatus, setWsStatus] = useState('connecting')
  const wsRef = useRef(null)

  const fetchTask = useCallback(async () => {
    try {
      const res = await getTask(id)
      setTask(res.data)
      setLogs(res.data.logs || [])
    } catch {
      navigate('/')
    }
  }, [id, navigate])

  useEffect(() => {
    fetchTask()

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/tasks/${id}/ws`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => setWsStatus('connected')
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'progress') {
        setLogs((prev) => [...prev, msg.data])
      } else if (msg.type === 'status') {
        fetchTask()
      }
    }
    ws.onclose = () => setWsStatus('disconnected')
    ws.onerror = () => setWsStatus('error')

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 30000)

    return () => {
      clearInterval(ping)
      ws.close()
    }
  }, [fetchTask, id])

  useEffect(() => {
    if (task?.status !== 'awaiting_confirmation') {
      setDraft(null)
      setDraftError('')
      return
    }
    getStoryboard(id)
      .then((response) => {
        setDraft(response.data)
        setDraftError('')
      })
      .catch((error) => setDraftError(error.response?.data?.detail || '分镜草案加载失败'))
  }, [id, task?.status, task?.draft_revision])

  const handleDownload = async () => {
    try {
      const res = await downloadTaskResult(id)
      const isVideo = task.type === 'end_to_end'
      const blob = new Blob([res.data], {
        type: isVideo ? 'video/mp4' : 'application/json',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = isVideo ? `task_${id}_result.mp4` : `task_${id}_result.json`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('下载失败')
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定删除该任务？')) return
    await deleteTask(id)
    navigate(task.project_id ? `/projects/${task.project_id}` : '/')
  }

  if (!task) {
    return <div className="py-16 text-center text-sm text-[#5a5a7a]">加载中...</div>
  }

  const isSuccess = task.status === 'success' && task.result_path
  const typeLabel = TASK_TYPE_LABELS[task.type] || task.type

  return (
    <div>
      <SectionHeader
        title={`任务 #${task.id}`}
        description={typeLabel}
        backTo={task.project_id ? `/projects/${task.project_id}` : '/'}
        actions={
          <>
            <Button
              variant="secondary"
              icon={Bot}
              onClick={() => navigate(`/assistant?project_id=${task.project_id}&task_id=${task.id}`)}
            >
              智能助手
            </Button>
            {isSuccess && (
              <Button icon={Download} onClick={handleDownload}>
                {task.type === 'end_to_end' ? '下载视频' : '下载结果'}
              </Button>
            )}
            <Button variant="danger" icon={Trash2} onClick={handleDelete}>
              删除
            </Button>
          </>
        }
      />

      {/* 状态概览卡 */}
      <Card className="mb-6 p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusPill status={task.status} />
            <span className="text-sm text-[#8888a8]">进度 {task.progress}%</span>
          </div>
          <WsDot status={wsStatus} />
        </div>

        <StepTimeline logs={logs} taskStatus={task.status} taskType={task.type} />

        <ProgressBar value={task.progress} className="mt-5" />
      </Card>

      {/* 错误信息 */}
      {task.error_message && (
        <div className="mb-6">
          <InfoBar type="error">{task.error_message}</InfoBar>
        </div>
      )}

      {task.status === 'awaiting_confirmation' && draftError && (
        <div className="mb-6">
          <InfoBar type="error">{draftError}</InfoBar>
        </div>
      )}

      {task.status === 'awaiting_confirmation' && draft && (
        <StoryboardEditor
          taskId={task.id}
          draft={draft}
          onDraftChange={(nextDraft) => {
            setDraft(nextDraft)
            setTask((current) => ({ ...current, draft_revision: nextDraft.revision }))
          }}
          onConfirmed={(nextTask) => {
            setTask(nextTask)
            setLogs(nextTask.logs || [])
            setDraft(null)
          }}
        />
      )}

      {/* 视频预览（仅端到端任务） */}
      {isSuccess && task.type === 'end_to_end' && (
        <Card className="mb-6 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">生成结果</h2>
          <video
            src={mediaUrl(`/tasks/${id}/download`)}
            controls
            className="w-full rounded-xl bg-black"
          />
        </Card>
      )}

      {/* 日志终端 */}
      <LogTerminal logs={logs} />
    </div>
  )
}

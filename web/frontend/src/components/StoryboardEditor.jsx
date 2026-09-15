import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Image as ImageIcon,
  Save,
  Trash2,
} from 'lucide-react'
import { confirmStoryboard, mediaUrl, updateStoryboard } from '../api.js'
import { Badge, Button, Card, Field, InfoBar, SelectInput, TextInput } from './ui.jsx'

const TRANSITIONS = [
  ['cut', '硬切'],
  ['fade', '淡入淡出'],
  ['dissolve', '叠化'],
  ['zoom_in', '推进'],
  ['zoom_out', '拉远'],
  ['slide_left', '左滑'],
  ['slide_right', '右滑'],
  ['wipe_left', '左擦除'],
  ['wipe_right', '右擦除'],
  ['blur_in', '模糊进入'],
  ['whip', '甩镜'],
  ['flash_white', '白闪'],
  ['circle_reveal', '圆形揭示'],
  ['glitch', '故障闪烁'],
  ['zoom_through', '穿越缩放'],
  ['liquid_warp', '液态形变'],
  ['chromatic_aberration', 'RGB 色差'],
  ['none', '无转场'],
]

function editableFrame(frame) {
  return {
    ...frame,
    material_id: frame.material_id || '',
    subtitle_text: frame.subtitle_text || '',
    transition: frame.transition || 'cut',
    duration: Number(frame.duration || 1),
  }
}

export default function StoryboardEditor({ taskId, draft, onDraftChange, onConfirmed }) {
  const [title, setTitle] = useState(draft.title || '')
  const [frames, setFrames] = useState(() => draft.storyboard.map(editableFrame))
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setTitle(draft.title || '')
    setFrames(draft.storyboard.map(editableFrame))
  }, [draft])

  const materialMap = useMemo(
    () => new Map(draft.materials.map((material) => [material.id, material])),
    [draft.materials]
  )
  const totalDuration = frames.reduce((sum, frame) => sum + Number(frame.duration || 0), 0)

  const updateFrame = (index, patch) => {
    setFrames((current) => current.map((frame, i) => (i === index ? { ...frame, ...patch } : frame)))
    setMessage('')
  }

  const moveFrame = (index, offset) => {
    const target = index + offset
    if (target < 0 || target >= frames.length) return
    setFrames((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setMessage('')
  }

  const removeFrame = (index) => {
    if (frames.length <= 1) return
    setFrames((current) => current.filter((_, i) => i !== index))
    setMessage('')
  }

  const payload = () => ({
    title,
    revision: draft.revision,
    storyboard: frames.map((frame) => ({
      draft_id: frame.draft_id,
      material_id: frame.material_id,
      duration: Number(frame.duration),
      subtitle_text: frame.subtitle_text,
      transition: frame.transition,
    })),
  })

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await updateStoryboard(taskId, payload())
      onDraftChange(response.data)
      setMessage(`第 ${response.data.revision} 版已保存`)
      return response.data
    } catch (err) {
      setError(err.response?.data?.detail || '保存分镜失败')
      return null
    } finally {
      setSaving(false)
    }
  }

  const confirm = async () => {
    setConfirming(true)
    setError('')
    try {
      const saved = await save()
      if (!saved) return
      const response = await confirmStoryboard(taskId)
      onConfirmed(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || '提交渲染失败')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="border-b border-[#2a2a42] bg-[linear-gradient(135deg,rgba(124,92,252,0.12),rgba(0,212,255,0.04))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge color="amber">等待确认</Badge>
              <span className="text-xs text-[#8888a8]">当前第 {draft.revision} 版</span>
            </div>
            <h2 className="text-base font-semibold text-white">分镜确认台</h2>
            <p className="mt-1 text-sm text-[#8888a8]">
              调整顺序、素材、时长、字幕与转场；确认后才会开始正式渲染。
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#2a2a42] bg-[#14141f] px-3 py-2 text-sm text-[#c8c8e0]">
            <Clock3 size={15} className="text-[#66e0ff]" />
            {frames.length} 个分镜 · {totalDuration.toFixed(1)} 秒
          </div>
        </div>

        <Field label="作品标题" className="mt-4 max-w-xl">
          <TextInput value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
        </Field>
      </div>

      <div className="space-y-3 p-5">
        {frames.map((frame, index) => {
          const material = materialMap.get(frame.material_id)
          return (
            <div
              key={frame.draft_id}
              className="grid gap-4 rounded-xl border border-[#2a2a42] bg-[#101019] p-3 lg:grid-cols-[112px_minmax(0,1fr)_180px_80px]"
            >
              <div className="relative h-28 overflow-hidden rounded-lg bg-[#1c1c2b]">
                {material ? (
                  <img
                    src={mediaUrl(material.preview_url)}
                    alt={material.filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#5a5a7a]">
                    <ImageIcon size={24} />
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>

              <div className="min-w-0 space-y-3">
                <Field label="使用素材">
                  <SelectInput
                    value={frame.material_id}
                    onChange={(event) => updateFrame(index, { material_id: event.target.value })}
                  >
                    <option value="">不使用图片素材</option>
                    {draft.materials.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.description || item.filename || item.id}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="字幕">
                  <TextInput
                    value={frame.subtitle_text}
                    maxLength={200}
                    placeholder="该镜头不显示字幕"
                    onChange={(event) => updateFrame(index, { subtitle_text: event.target.value })}
                  />
                </Field>
                {frame.render_component && frame.render_component !== 'auto' && (
                  <div className="flex items-center gap-2 text-xs text-[#8888a8]">
                    <Badge color="violet">高级动效</Badge>
                    <span>{frame.render_component.replace(/^custom:/, '')}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Field label="时长（秒）">
                  <TextInput
                    type="number"
                    min="0.2"
                    max="30"
                    step="0.1"
                    value={frame.duration}
                    onChange={(event) => updateFrame(index, { duration: event.target.value })}
                  />
                </Field>
                <Field label="转场">
                  <SelectInput
                    value={frame.transition}
                    onChange={(event) => updateFrame(index, { transition: event.target.value })}
                  >
                    {TRANSITIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>

              <div className="flex items-center justify-end gap-1 lg:flex-col lg:justify-start">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ArrowUp}
                  disabled={index === 0}
                  title="上移"
                  onClick={() => moveFrame(index, -1)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ArrowDown}
                  disabled={index === frames.length - 1}
                  title="下移"
                  onClick={() => moveFrame(index, 1)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  disabled={frames.length <= 1}
                  title="删除分镜"
                  onClick={() => removeFrame(index)}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2a2a42] bg-[#101019] px-5 py-4">
        <div>
          {error && <InfoBar type="error">{error}</InfoBar>}
          {!error && message && <span className="text-sm text-[#6ee7b7]">{message}</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Save} loading={saving} disabled={confirming} onClick={save}>
            保存草案
          </Button>
          <Button icon={CheckCircle2} loading={confirming} disabled={saving} onClick={confirm}>
            确认并开始渲染
          </Button>
        </div>
      </div>
    </Card>
  )
}

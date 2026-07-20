import { useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { deleteApiKey, listApiKeys, saveApiKey } from '../api.js'
import {
  Badge,
  Button,
  Card,
  Field,
  InfoBar,
  SectionHeader,
  SelectInput,
  TextInput,
} from '../components/ui.jsx'

const PROVIDERS = [
  { key: 'zhipu', label: '智谱 AI', env: 'ZHIPU_API_KEY', required: true },
  { key: 'deepseek', label: 'DeepSeek', env: 'DEEPSEEK_API_KEY' },
  { key: 'moonshot', label: 'Moonshot', env: 'MOONSHOT_API_KEY' },
  { key: 'aliyun', label: '阿里云', env: 'ALIYUN_ACCESS_KEY_ID' },
]

export default function Settings() {
  const [keys, setKeys] = useState({})
  const [inputValue, setInputValue] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('zhipu')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null) // { type, text }

  const fetchKeys = async () => {
    try {
      const res = await listApiKeys()
      const map = {}
      res.data.forEach((k) => {
        map[k.provider] = true
      })
      setKeys(map)
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || '加载失败' })
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    setLoading(true)
    setMessage(null)
    try {
      await saveApiKey(selectedProvider, inputValue.trim())
      setInputValue('')
      await fetchKeys()
      setMessage({ type: 'success', text: 'API Key 已保存' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || '保存失败' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (provider) => {
    if (!confirm('确定删除该 API Key？')) return
    try {
      await deleteApiKey(provider)
      await fetchKeys()
      setMessage({ type: 'success', text: '已删除' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || '删除失败' })
    }
  }

  return (
    <div>
      <SectionHeader
        title="设置"
        description="配置你自己的模型 API Key，任务运行时会优先使用它们"
      />

      <div className="max-w-2xl space-y-6">
        <div className="mb-0">
          <InfoBar type="info">
            当前流水线核心依赖<strong>智谱 AI（GLM-4.6V）</strong>做视频与素材分析，
            未配置时任务会直接失败。你也可以让管理员在{' '}
            <code className="rounded bg-[rgba(0,212,255,0.08)] px-1 py-0.5 text-xs">
              viral-structure-engine/.env
            </code>{' '}
            中配置系统默认 Key。
          </InfoBar>
        </div>

        {/* 保存表单 */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound size={16} className="text-[#b49aff]" />
            添加 / 更新 API Key
          </h2>
          <form onSubmit={handleSave} className="flex flex-wrap items-end gap-4">
            <Field label="服务商" className="min-w-[160px]">
              <SelectInput
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                    {p.required ? '（必需）' : ''}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="API Key" className="min-w-[240px] flex-1">
              <TextInput
                type="password"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="输入 Key，仅存储在你的账号下"
              />
            </Field>
            <Button type="submit" loading={loading}>
              保存
            </Button>
          </form>
          {message && (
            <div className="mt-4">
              <InfoBar type={message.type}>{message.text}</InfoBar>
            </div>
          )}
        </Card>

        {/* 已配置列表 */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck size={16} className="text-[#6ee7b7]" />
            已配置的服务商
          </h2>
          <ul className="divide-y divide-[#2a2a42]">
            {PROVIDERS.map((p) => (
              <li key={p.key} className="flex items-center justify-between py-3">
                <div>
                  <span className="text-sm font-medium text-[#c8c8e0]">
                    {p.label}
                    {p.required && <span className="ml-1 text-[#f87171]">*</span>}
                  </span>
                  <span className="ml-2 text-xs text-[#5a5a7a]">{p.env}</span>
                </div>
                <div className="flex items-center gap-3">
                  {keys[p.key] ? (
                    <>
                      <Badge color="green">已设置</Badge>
                      <button
                        onClick={() => handleDelete(p.key)}
                        title="删除"
                        className="rounded-lg p-1 text-[#5a5a7a] transition-all hover:bg-[rgba(248,113,113,0.08)] hover:text-[#f87171]"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : (
                    <Badge color="gray">未设置</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

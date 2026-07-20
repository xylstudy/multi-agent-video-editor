import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clapperboard } from 'lucide-react'
import { register } from '../api.js'
import { Button, Field, InfoBar, TextInput } from '../components/ui.jsx'

export default function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(username, password, email)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="vc-bg-hero flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm vc-fade-in">
        {/* 品牌区 */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c5cfc] to-[#00d4ff] text-white shadow-[0_0_24px_rgba(124,92,252,0.3)]">
            <Clapperboard size={26} />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-white">Video Claw</h1>
          <p className="mt-1 text-sm text-[#8888a8]">爆款 Vlog 结构迁移引擎</p>
        </div>

        {/* 表单卡片 */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(20,20,31,0.85)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl"
        >
          <h2 className="mb-1 text-base font-semibold text-white">创建账号</h2>
          <p className="mb-5 text-sm text-[#5a5a7a]">开始生成属于你的 Vlog</p>

          {error && (
            <div className="mb-4">
              <InfoBar type="error">{error}</InfoBar>
            </div>
          )}

          <div className="space-y-4">
            <Field label="用户名">
              <TextInput
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入用户名"
                autoComplete="username"
                required
              />
            </Field>
            <Field label="邮箱" hint="可选，用于找回账号">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </Field>
            <Field label="密码">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="设置密码"
                autoComplete="new-password"
                required
              />
            </Field>
          </div>

          <Button type="submit" loading={loading} className="mt-6 w-full">
            注册
          </Button>

          <p className="mt-4 text-center text-sm text-[#5a5a7a]">
            已有账号？{' '}
            <Link to="/login" className="font-medium text-[#b49aff] hover:text-[#9478ff] transition-colors">
              登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

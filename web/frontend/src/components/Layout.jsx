import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Clapperboard,
  Dna,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  PlaySquare,
  Settings,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const NAV_ITEMS = [
  { to: '/', label: '工作台', icon: LayoutDashboard, end: true },
  { to: '/projects', label: '项目', icon: FolderOpen },
  { to: '/genes', label: '基因库', icon: Dna },
  { to: '/knowledge', label: '知识库', icon: BookOpen },
  { to: '/insights', label: '统计洞察', icon: BarChart3 },
  { to: '/works', label: '作品集', icon: PlaySquare },
  { to: '/settings', label: '设置', icon: Settings },
]

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth()

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c5cfc] to-[#00d4ff] text-white shadow-[0_0_16px_rgba(124,92,252,0.2)]">
          <Clapperboard size={20} />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-white">Video Claw</div>
          <div className="text-[11px] text-[#5a5a7a]">Vlog 结构迁移引擎</div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-[rgba(124,92,252,0.12)] font-medium text-[#b49aff] shadow-[inset_0_0_0_1px_rgba(124,92,252,0.2)]'
                  : 'text-[#8888a8] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#e8e8f0]'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* 底部用户区 */}
      <div className="border-t border-[#2a2a42] px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c5cfc] to-[#00d4ff] text-[11px] font-bold text-white">
              {(user?.username || '?').slice(0, 2).toUpperCase()}
            </div>
            <span className="truncate text-sm text-[#c8c8e0]">{user?.username}</span>
          </div>
          <button
            onClick={logout}
            title="退出登录"
            className="rounded-lg p-1.5 text-[#5a5a7a] transition-all hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f87171]"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0c0c14]">
      {/* 桌面端侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-[#2a2a42] bg-[#0f0f1a] lg:block">
        <SidebarContent />
      </aside>

      {/* 移动端顶部条 */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#2a2a42] bg-[#0f0f1a] px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c5cfc] to-[#00d4ff] text-white">
            <Clapperboard size={16} />
          </div>
          <span className="text-sm font-bold text-white">Video Claw</span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-[#8888a8] hover:bg-[rgba(255,255,255,0.05)]"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-60 border-r border-[#2a2a42] bg-[#0f0f1a] shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* 内容区 */}
      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1100px] px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

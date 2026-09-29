import { useEffect, useMemo, useState } from 'react'
import talk2Icon from '../../../../assets/talk2-icon.png'
import { ArchiveRestore, Copy, FileUp, MoreHorizontal, Plus, Search, Settings, Trash2 } from 'lucide-react'
import type { AppSettings, ProjectBundle, ProjectSummary } from '../../../shared/types'
import { SettingsModal } from './SettingsModal'

interface Props {
  settings: AppSettings | null
  onSettings: (settings: AppSettings) => void
  onOpen: (project: ProjectBundle) => void
}

export function LibraryView({ settings, onSettings, onOpen }: Props): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [query, setQuery] = useState('')
  const [trashed, setTrashed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    const result = await window.speechDesk.library.list(trashed)
    setLoading(false)
    if (result.ok) { setProjects(result.data ?? []); setError(null) }
    else setError(result.error ?? '无法载入资料库')
  }

  useEffect(() => { void refresh() }, [trashed])

  const visible = useMemo(() => projects.filter((project) => project.title.toLowerCase().includes(query.trim().toLowerCase())), [projects, query])

  const create = async (): Promise<void> => {
    const result = await window.speechDesk.projects.create('未命名演讲')
    if (result.ok && result.data) onOpen(result.data); else setError(result.error ?? '创建失败')
  }

  const open = async (id: string): Promise<void> => {
    const result = await window.speechDesk.projects.load(id)
    if (result.ok && result.data) onOpen(result.data); else setError(result.error ?? '打开失败')
  }

  const importBackup = async (): Promise<void> => {
    const result = await window.speechDesk.backup.import()
    if (result.ok && result.data) onOpen(result.data); else if (!result.ok) setError(result.error ?? '导入失败')
  }

  return <div className="app-shell library-shell">
    <aside className="sidebar">
      <div className="brand"><img className="brand-mark" src={talk2Icon} alt="" /><span>Talk2</span></div>
      <nav>
        <button className={!trashed ? 'active' : ''} onClick={() => setTrashed(false)}>演讲资料库</button>
        <button className={trashed ? 'active' : ''} onClick={() => setTrashed(true)}><Trash2 />回收站</button>
      </nav>
      <div className="sidebar-bottom">
        <button onClick={() => setSettingsOpen(true)}><Settings />设置</button>
      </div>
    </aside>
    <main className="library-main">
      <header className="library-header">
        <div><p className="eyebrow">本地工作区</p><h1>{trashed ? '回收站' : '演讲资料库'}</h1></div>
        {!trashed && <div className="library-actions">
          <button className="secondary-button" onClick={() => void importBackup()}><FileUp />导入备份</button>
          <button className="primary-button" onClick={() => void create()}><Plus />新建演讲</button>
        </div>}
      </header>
      <div className="search-box"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索演讲…" /></div>
      {error && <div className="error-banner">{error}<button onClick={() => setError(null)}>关闭</button></div>}
      {loading ? <div className="empty-state">正在载入资料库…</div> : visible.length === 0 ? <div className="empty-state">
        <div className="empty-icon">{trashed ? <Trash2 /> : <img src={talk2Icon} alt="" />}</div>
        <h2>{trashed ? '回收站是空的' : '从第一场演讲开始'}</h2>
        <p>{trashed ? '删除的演讲会暂时保留在这里。' : '创建节点、粘贴讲稿，然后用连线安排讲述顺序。'}</p>
        {!trashed && <button className="primary-button" onClick={() => void create()}><Plus />新建演讲</button>}
      </div> : <div className="project-grid">
        {visible.map((project) => <article key={project.id} className="project-card" onDoubleClick={() => void open(project.id)}>
          <button className="project-preview" onClick={() => void open(project.id)}>
            <div className="preview-node primary-preview"></div><div className="preview-line"></div><div className="preview-node"></div>
          </button>
          <div className="project-meta">
            <div><h2>{project.title}</h2><p>{project.nodeCount} 个节点 · {formatDate(project.updatedAt)}</p></div>
            <details>
              <summary><MoreHorizontal /></summary>
              <div className="card-menu">
                {trashed ? <>
                  <button onClick={async () => { await window.speechDesk.projects.restore(project.id); void refresh() }}><ArchiveRestore />恢复</button>
                  <button className="danger" onClick={async () => { if (confirm('永久删除后无法恢复，确定继续吗？')) { await window.speechDesk.projects.removeForever(project.id); void refresh() } }}><Trash2 />永久删除</button>
                </> : <>
                  <button onClick={async () => { await window.speechDesk.projects.duplicate(project.id); void refresh() }}><Copy />创建副本</button>
                  <button className="danger" onClick={async () => { await window.speechDesk.projects.moveToTrash(project.id); void refresh() }}><Trash2 />移到回收站</button>
                </>}
              </div>
            </details>
          </div>
        </article>)}
      </div>}
    </main>
    {settingsOpen && settings && <SettingsModal settings={settings} onChange={onSettings} onClose={() => setSettingsOpen(false)} />}
  </div>
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

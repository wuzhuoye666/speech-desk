import { app, BrowserWindow, globalShortcut, ipcMain, net, protocol, screen } from 'electron'
import { join, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { SpeechDatabase } from './database'
import { exportProject, importProject } from './backup'
import { fitBoundsToWorkArea } from './windowBounds'
import { assetImportSchema, hotkeySettingsSchema, projectBundleSchema, prompterSettingsSchema } from '../shared/schemas'
import { buildPlaybackChain } from '../shared/graph'
import type { ApiResult, AppSettings, HotkeySettings, ProjectBundle, PrompterState, SpeechNode } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let prompterWindow: BrowserWindow | null = null
let db: SpeechDatabase
let playback: { project: ProjectBundle; chain: SpeechNode[]; index: number } | null = null

if (process.env.SPEECH_DESK_QA_USER_DATA) app.setPath('userData', process.env.SPEECH_DESK_QA_USER_DATA)

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

const ok = <T>(data?: T): ApiResult<T> => ({ ok: true, data })
const fail = (error: unknown): ApiResult<never> => ({ ok: false, error: error instanceof Error ? error.message : '发生未知错误' })
const handle = <TArgs extends unknown[], TResult>(channel: string, action: (...args: TArgs) => TResult | Promise<TResult>): void => {
  ipcMain.handle(channel, async (_event, ...args: TArgs) => {
    try { return ok(await action(...args)) } catch (error) { return fail(error) }
  })
}

protocol.registerSchemesAsPrivileged([{ scheme: 'speech-asset', privileges: { secure: true, supportFetchAPI: true, stream: true } }])

function createMainWindow(query?: Record<string, string>): void {
  mainWindow = new BrowserWindow({
    width: 1360, height: 860, minWidth: 980, minHeight: 650, show: false,
    title: '演讲台', backgroundColor: '#f6f6f4',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  const revealWindow = (): void => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show()
  }
  mainWindow.once('ready-to-show', revealWindow)
  mainWindow.webContents.once('did-finish-load', revealWindow)
  if (process.env.SPEECH_DESK_QA_LOG) {
    mainWindow.webContents.on('console-message', (_event, level, message) => {
      writeFileSync(process.env.SPEECH_DESK_QA_LOG!, `${new Date().toISOString()} ${level} ${message}\n`, { flag: 'a' })
    })
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      writeFileSync(process.env.SPEECH_DESK_QA_LOG!, `${new Date().toISOString()} renderer-gone ${JSON.stringify(details)}\n`, { flag: 'a' })
    })
  }
  mainWindow.on('closed', () => {
    mainWindow = null
    if (prompterWindow && !prompterWindow.isDestroyed()) prompterWindow.close()
  })
  loadRenderer(mainWindow, '', query)
}

function loadRenderer(window: BrowserWindow, hash = '', query?: Record<string, string>): void {
  const search = query ? `?${new URLSearchParams(query).toString()}` : ''
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(`${process.env.ELECTRON_RENDERER_URL}${search}${hash}`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { query, ...(hash ? { hash: hash.replace(/^#/, '') } : {}) })
  }
}

function ensurePrompterWindow(): BrowserWindow {
  if (prompterWindow && !prompterWindow.isDestroyed()) return prompterWindow
  const settings = db.getSettings().prompter
  const display = settings.displayId ? screen.getAllDisplays().find((item) => String(item.id) === settings.displayId) : screen.getPrimaryDisplay()
  const area = (display ?? screen.getPrimaryDisplay()).workArea
  const defaultWidth = Math.min(1100, Math.round(area.width * 0.72))
  const defaultHeight = 180
  const initialBounds = settings.bounds ?? {
    x: area.x + Math.round((area.width - defaultWidth) / 2),
    y: area.y + area.height - defaultHeight - 24,
    width: defaultWidth,
    height: defaultHeight
  }
  const bounds = fitBoundsToWorkArea(initialBounds, area)
  prompterWindow = new BrowserWindow({
    ...bounds, minWidth: 420, minHeight: 100,
    frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: true,
    show: false, backgroundColor: '#00000000', hasShadow: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  prompterWindow.setAlwaysOnTop(true, 'screen-saver')
  prompterWindow.setContentProtection(settings.contentProtection)
  prompterWindow.setOpacity(settings.opacity)
  prompterWindow.setIgnoreMouseEvents(settings.clickThrough, { forward: true })
  prompterWindow.on('closed', () => { prompterWindow = null })
  prompterWindow.on('show', sendPrompterState)
  prompterWindow.on('moved', persistPrompterBounds)
  prompterWindow.on('resized', persistPrompterBounds)
  loadRenderer(prompterWindow, '#/prompter')
  return prompterWindow
}

function persistPrompterBounds(): void {
  if (!prompterWindow || prompterWindow.isDestroyed()) return
  const settings = db.getSettings()
  const bounds = prompterWindow.getBounds()
  const display = screen.getDisplayMatching(bounds)
  settings.prompter = { ...settings.prompter, bounds, displayId: String(display.id) }
  db.saveSettings(settings)
}

function currentPrompterState(): PrompterState | null {
  if (!playback) return null
  const node = playback.chain[playback.index]
  if (!node) return null
  return {
    projectId: playback.project.presentation.id,
    projectTitle: playback.project.presentation.title,
    currentNodeId: node.id,
    title: node.title,
    content: node.content,
    position: playback.index + 1,
    total: playback.chain.length,
    atEnd: playback.index === playback.chain.length - 1,
    settings: db.getSettings().prompter
  }
}

function sendPrompterState(): void {
  const state = currentPrompterState()
  if (state && prompterWindow && !prompterWindow.isDestroyed()) prompterWindow.webContents.send('prompter:state', state)
}

function navigate(direction: 'next' | 'previous'): void {
  if (!playback) return
  const delta = direction === 'next' ? 1 : -1
  playback.index = Math.max(0, Math.min(playback.chain.length - 1, playback.index + delta))
  sendPrompterState()
}

function togglePrompterVisibility(): void {
  if (!prompterWindow) return
  prompterWindow.isVisible() ? prompterWindow.hide() : prompterWindow.showInactive()
}

function toggleClickThrough(): void {
  if (!prompterWindow) return
  const settings = db.getSettings()
  settings.prompter.clickThrough = !settings.prompter.clickThrough
  db.saveSettings(settings)
  prompterWindow.setIgnoreMouseEvents(settings.prompter.clickThrough, { forward: true })
  sendPrompterState()
}

function registerHotkeys(bindings: HotkeySettings): void {
  globalShortcut.unregisterAll()
  const actions: Array<[string, () => void]> = [
    [bindings.next, () => navigate('next')],
    [bindings.previous, () => navigate('previous')],
    [bindings.scrollUp, () => prompterWindow?.webContents.send('prompter:scroll', 'up')],
    [bindings.scrollDown, () => prompterWindow?.webContents.send('prompter:scroll', 'down')],
    [bindings.toggleVisibility, togglePrompterVisibility],
    [bindings.toggleClickThrough, toggleClickThrough]
  ]
  const registered: string[] = []
  for (const [accelerator, action] of actions) {
    if (!globalShortcut.register(accelerator, action)) {
      for (const key of registered) globalShortcut.unregister(key)
      throw new Error(`快捷键 ${accelerator} 已被其他应用占用`)
    }
    registered.push(accelerator)
  }
}

function registerIpc(): void {
  ipcMain.on('prompter:scroll', (_event, direction: 'up' | 'down') => prompterWindow?.webContents.send('prompter:scroll', direction))
  // The prompter renderer asks for the current state once it is mounted and listening,
  // so state sent before the listener existed is never lost.
  ipcMain.on('prompter:ready', () => sendPrompterState())
  handle('library:list', (trashed?: boolean) => db.listProjects(Boolean(trashed)))
  handle('projects:create', (title?: string) => db.createProject(z.string().max(200).optional().parse(title)))
  handle('projects:load', (id: string) => db.loadProject(z.string().uuid().parse(id)))
  handle('projects:save', (input: unknown) => db.saveProject(projectBundleSchema.parse(input) as ProjectBundle))
  handle('projects:rename', (id: string, title: string) => db.renameProject(z.string().uuid().parse(id), z.string().min(1).max(200).parse(title)))
  handle('projects:duplicate', (id: string) => db.duplicateProject(z.string().uuid().parse(id)))
  handle('projects:trash', (id: string) => db.moveToTrash(z.string().uuid().parse(id)))
  handle('projects:restore', (id: string) => db.restore(z.string().uuid().parse(id)))
  handle('projects:remove', (id: string) => db.removeForever(z.string().uuid().parse(id)))
  handle('backup:export', (id: string) => exportProject(db, z.string().uuid().parse(id)))
  handle('backup:import', () => importProject(db))
  handle('assets:import', (raw: unknown) => {
    const input = assetImportSchema.parse(raw)
    const id = randomUUID()
    const extension = safeImageExtension(input.name, input.mimeType)
    const dir = join(db.assetsDir, input.projectId)
    mkdirSync(dir, { recursive: true })
    const filePath = join(dir, `${id}${extension}`)
    writeFileSync(filePath, Buffer.from(input.bytes))
    const assetId = db.addAsset({ projectId: input.projectId, name: input.name, mimeType: input.mimeType, filePath })
    return `speech-asset://asset/${assetId}`
  })
  handle('presentation:start', (raw: unknown) => {
    const input = z.object({ projectId: z.string().uuid(), startNodeId: z.string().uuid().optional() }).parse(raw)
    const project = db.loadProject(input.projectId)
    const chain = buildPlaybackChain(project.nodes, project.edges, input.startNodeId ?? project.presentation.startNodeId)
    if (!chain.length) throw new Error('请先设置有效的演讲起点')
    playback = { project, chain, index: 0 }
    const window = ensurePrompterWindow()
    window.webContents.once('did-finish-load', sendPrompterState)
    window.showInactive()
    sendPrompterState()
  })
  handle('presentation:stop', () => { playback = null; prompterWindow?.hide() })
  handle('presentation:navigate', (direction: unknown) => navigate(z.enum(['next', 'previous']).parse(direction)))
  handle('prompter:update-settings', (patch: unknown) => {
    const settings = db.getSettings()
    const next = prompterSettingsSchema.parse({ ...settings.prompter, ...(patch as object) })
    settings.prompter = next
    db.saveSettings(settings)
    if (prompterWindow) {
      prompterWindow.setContentProtection(next.contentProtection)
      prompterWindow.setOpacity(next.opacity)
      prompterWindow.setIgnoreMouseEvents(next.clickThrough, { forward: true })
    }
    sendPrompterState()
    return next
  })
  handle('prompter:resize', (rawHeight: unknown) => {
    if (!prompterWindow) return
    const height = z.number().finite().parse(rawHeight)
    const display = screen.getDisplayMatching(prompterWindow.getBounds())
    const maxHeight = Math.round(display.workArea.height * db.getSettings().prompter.maxHeightRatio)
    const bounds = prompterWindow.getBounds()
    const nextHeight = Math.max(100, Math.min(maxHeight, Math.ceil(height)))
    const bottom = bounds.y + bounds.height
    prompterWindow.setBounds({ ...bounds, y: bottom - nextHeight, height: nextHeight }, true)
  })
  handle('settings:get', () => db.getSettings())
  handle('settings:theme', (theme: unknown) => {
    const settings = db.getSettings()
    settings.theme = z.enum(['system', 'light', 'dark']).parse(theme)
    return db.saveSettings(settings)
  })
  handle('hotkeys:update', (raw: unknown) => {
    const bindings = hotkeySettingsSchema.parse(raw)
    const previous = db.getSettings().hotkeys
    try {
      registerHotkeys(bindings)
      const settings = db.getSettings(); settings.hotkeys = bindings; db.saveSettings(settings)
      return bindings
    } catch (error) {
      registerHotkeys(previous)
      throw error
    }
  })
}

function safeImageExtension(name: string, mimeType: string): string {
  const extension = extname(name).toLowerCase()
  if (/^\.(png|jpe?g|gif|webp|svg)$/.test(extension)) return extension
  return { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' }[mimeType] ?? '.img'
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return
  db = new SpeechDatabase()
  protocol.handle('speech-asset', (request) => {
    const url = new URL(request.url)
    const assetId = url.pathname.replace(/^\//, '')
    const asset = db.getAsset(assetId)
    if (!asset) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(asset.filePath).toString())
  })
  registerIpc()
  try {
    registerHotkeys(db.getSettings().hotkeys)
  } catch (error) {
    // A shortcut conflict must not make the application appear to do nothing.
    console.error('全局快捷键注册失败，应用将继续启动：', error)
  }
  const qaView = process.env.SPEECH_DESK_QA_VIEW
  const qaProject = qaView === 'editor' || qaView === 'prompter' ? db.createProject('产品演示：高质量沟通') : null
  if (qaProject) {
    qaProject.nodes[0].content = {
      type: 'doc', content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '让复杂内容变得清晰' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '把 AI 生成的结构化讲稿直接粘贴进节点，再用连线安排讲述顺序。' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '\\(V = S_t - \\dfrac{F_0}{(1+r)^T}\\)' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '完整保留标题、列表与代码' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '演讲时使用私有悬浮提词窗' }] }] }
        ] }
      ]
    }
    if (qaView === 'editor') {
      const now = new Date().toISOString()
      const secondId = randomUUID()
      qaProject.nodes.push({
        id: secondId, presentationId: qaProject.presentation.id, title: '核心观点',
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '第二个演讲块，用连线承接上一段内容。' }] }] },
        position: { x: 720, y: 190 }, size: { width: 420, height: 260 }, createdAt: now, updatedAt: now
      })
      qaProject.edges.push({
        id: randomUUID(), presentationId: qaProject.presentation.id,
        sourceNodeId: qaProject.nodes[0].id, targetNodeId: secondId
      })
    }
    db.saveProject(qaProject)
  }
  createMainWindow(qaProject && qaView === 'editor' ? { qaProject: qaProject.presentation.id } : undefined)
  if (qaProject && qaView === 'prompter') {
    playback = { project: qaProject, chain: qaProject.nodes, index: 0 }
    const window = ensurePrompterWindow(); window.webContents.once('did-finish-load', () => { sendPrompterState(); window.show() })
  }
  if (process.env.SPEECH_DESK_QA_SCREENSHOT) {
    setTimeout(async () => {
      try {
        const target = qaView === 'prompter' ? prompterWindow : mainWindow
        if (target && !target.isDestroyed()) {
          const image = await Promise.race([
            target.webContents.capturePage(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('截图等待超时')), 5000))
          ])
          writeFileSync(process.env.SPEECH_DESK_QA_SCREENSHOT!, image.toPNG())
          if (process.env.SPEECH_DESK_QA_REPORT) {
            const report = await target.webContents.executeJavaScript(`JSON.stringify({
            edges: [...document.querySelectorAll('.react-flow__edge-path')].map((edge) => ({
              d: edge.getAttribute('d'), stroke: getComputedStyle(edge).stroke,
              strokeWidth: getComputedStyle(edge).strokeWidth,
              rect: edge.getBoundingClientRect().toJSON()
            })),
            edgeSvg: document.querySelector('.react-flow__edges')?.getBoundingClientRect().toJSON(),
            edgeCount: document.querySelector('.canvas-wrap')?.getAttribute('data-edge-count'),
            flowState: document.querySelector('#flow-diagnostics')?.getAttribute('data-json'),
            handles: [...document.querySelectorAll('.react-flow__handle')].map((handle) => ({
              nodeId: handle.getAttribute('data-nodeid'), handleId: handle.getAttribute('data-handleid'),
              className: handle.className, rect: handle.getBoundingClientRect().toJSON()
            })),
            nodes: [...document.querySelectorAll('.react-flow__node')].map((node) => ({
              id: node.getAttribute('data-id'), className: node.className, rect: node.getBoundingClientRect().toJSON()
            }))
          })`)
            writeFileSync(process.env.SPEECH_DESK_QA_REPORT, report)
          }
        }
      } catch (error) {
        if (process.env.SPEECH_DESK_QA_LOG) writeFileSync(process.env.SPEECH_DESK_QA_LOG, `${new Date().toISOString()} capture-error ${String(error)}\n`, { flag: 'a' })
      } finally {
        app.exit(0)
      }
    }, 2200)
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('will-quit', () => globalShortcut.unregisterAll())

import type { JSONContent } from '@tiptap/core'

export type ThemeMode = 'system' | 'light' | 'dark'
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
export type FoldSplitRule = 'period' | 'newline'

export interface ViewportState { x: number; y: number; zoom: number }
export interface NodePosition { x: number; y: number }
export interface NodeSize { width: number; height: number }
export interface WindowBounds { x: number; y: number; width: number; height: number }

export interface Presentation {
  id: string
  title: string
  startNodeId: string | null
  viewport: ViewportState
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface SpeechNode {
  id: string
  presentationId: string
  title: string
  kind?: 'regular' | 'folded' | 'graph'
  splitRule?: FoldSplitRule
  content: JSONContent
  position: NodePosition
  size: NodeSize
  createdAt: string
  updatedAt: string
}

export interface SpeechEdge {
  id: string
  presentationId: string
  sourceNodeId: string
  targetNodeId: string
}

export interface ProjectBundle {
  presentation: Presentation
  nodes: SpeechNode[]
  edges: SpeechEdge[]
}

export interface ProjectSummary extends Presentation {
  nodeCount: number
}

export interface PrompterSettings {
  displayId: string | null
  bounds: WindowBounds | null
  maxHeightRatio: number
  fontScale: number
  opacity: number
  theme: ThemeMode
  clickThrough: boolean
  contentProtection: boolean
}

export interface HotkeySettings {
  next: string
  previous: string
  scrollUp: string
  scrollDown: string
  toggleVisibility: string
  toggleClickThrough: string
}

export interface AppSettings {
  theme: ThemeMode
  prompter: PrompterSettings
  hotkeys: HotkeySettings
}

export interface PrompterState {
  projectId: string
  projectTitle: string
  currentNodeId: string
  title: string
  content: JSONContent
  kind?: 'regular' | 'folded' | 'graph'
  position: number
  total: number
  atEnd: boolean
  settings: PrompterSettings
}

export interface AssetImportInput {
  projectId: string
  name: string
  mimeType: string
  bytes: Uint8Array
}

export interface ApiResult<T = void> {
  ok: boolean
  data?: T
  error?: string
}

export interface SpeechDeskApi {
  library: {
    list: (trashed?: boolean) => Promise<ApiResult<ProjectSummary[]>>
  }
  projects: {
    create: (title?: string) => Promise<ApiResult<ProjectBundle>>
    load: (id: string) => Promise<ApiResult<ProjectBundle>>
    save: (project: ProjectBundle) => Promise<ApiResult<ProjectBundle>>
    rename: (id: string, title: string) => Promise<ApiResult<void>>
    duplicate: (id: string) => Promise<ApiResult<ProjectBundle>>
    moveToTrash: (id: string) => Promise<ApiResult<void>>
    restore: (id: string) => Promise<ApiResult<void>>
    removeForever: (id: string) => Promise<ApiResult<void>>
  }
  backup: {
    export: (id: string) => Promise<ApiResult<string | null>>
    import: () => Promise<ApiResult<ProjectBundle | null>>
  }
  assets: {
    import: (input: AssetImportInput) => Promise<ApiResult<string>>
  }
  presentation: {
    start: (input: { projectId: string; startNodeId?: string }) => Promise<ApiResult<void>>
    stop: () => Promise<ApiResult<void>>
    navigate: (direction: 'next' | 'previous') => Promise<ApiResult<void>>
  }
  prompter: {
    updateSettings: (settings: Partial<PrompterSettings>) => Promise<ApiResult<PrompterSettings>>
    resizeToContent: (height: number) => Promise<ApiResult<void>>
    scroll: (direction: 'up' | 'down') => void
    onState: (callback: (state: PrompterState) => void) => () => void
    onScroll: (callback: (direction: 'up' | 'down') => void) => () => void
    /** Signal that the prompter renderer is mounted and listening; main replies with the current state. */
    ready: () => void
  }
  settings: {
    get: () => Promise<ApiResult<AppSettings>>
    updateTheme: (theme: ThemeMode) => Promise<ApiResult<AppSettings>>
  }
  hotkeys: {
    update: (bindings: HotkeySettings) => Promise<ApiResult<HotkeySettings>>
  }
}

export const DEFAULT_CONTENT: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '在这里粘贴或输入讲稿…' }] }]
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  prompter: {
    displayId: null,
    bounds: null,
    maxHeightRatio: 0.35,
    fontScale: 1,
    opacity: 0.96,
    theme: 'dark',
    clickThrough: false,
    contentProtection: true
  },
  hotkeys: {
    next: 'Alt+Right',
    previous: 'Alt+Left',
    scrollUp: 'Alt+Up',
    scrollDown: 'Alt+Down',
    toggleVisibility: 'Alt+Shift+P',
    toggleClickThrough: 'Alt+Shift+L'
  }
}

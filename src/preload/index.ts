import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, AssetImportInput, HotkeySettings, ProjectBundle, PrompterSettings, PrompterState, SpeechDeskApi, ThemeMode } from '../shared/types'

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api: SpeechDeskApi = {
  library: { list: (trashed = false) => invoke('library:list', trashed) },
  projects: {
    create: (title?: string) => invoke('projects:create', title),
    load: (id: string) => invoke('projects:load', id),
    save: (project: ProjectBundle) => invoke('projects:save', project),
    rename: (id: string, title: string) => invoke('projects:rename', id, title),
    duplicate: (id: string) => invoke('projects:duplicate', id),
    moveToTrash: (id: string) => invoke('projects:trash', id),
    restore: (id: string) => invoke('projects:restore', id),
    removeForever: (id: string) => invoke('projects:remove', id)
  },
  backup: { export: (id: string) => invoke('backup:export', id), import: () => invoke('backup:import') },
  assets: { import: (input: AssetImportInput) => invoke('assets:import', input) },
  presentation: {
    start: (input: { projectId: string; startNodeId?: string }) => invoke('presentation:start', input),
    stop: () => invoke('presentation:stop'),
    navigate: (direction: 'next' | 'previous') => invoke('presentation:navigate', direction)
  },
  prompter: {
    updateSettings: (settings: Partial<PrompterSettings>) => invoke('prompter:update-settings', settings),
    resizeToContent: (height: number) => invoke('prompter:resize', height),
    scroll: (direction: 'up' | 'down') => ipcRenderer.send('prompter:scroll', direction),
    onState: (callback: (state: PrompterState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: PrompterState) => callback(state)
      ipcRenderer.on('prompter:state', listener)
      return () => ipcRenderer.removeListener('prompter:state', listener)
    },
    onScroll: (callback: (direction: 'up' | 'down') => void) => {
      const listener = (_event: Electron.IpcRendererEvent, direction: 'up' | 'down') => callback(direction)
      ipcRenderer.on('prompter:scroll', listener)
      return () => ipcRenderer.removeListener('prompter:scroll', listener)
    },
    ready: () => ipcRenderer.send('prompter:ready')
  },
  settings: { get: () => invoke('settings:get') as Promise<{ ok: boolean; data?: AppSettings; error?: string }>, updateTheme: (theme: ThemeMode) => invoke('settings:theme', theme) },
  hotkeys: { update: (bindings: HotkeySettings) => invoke('hotkeys:update', bindings) }
}

contextBridge.exposeInMainWorld('speechDesk', api)

import { useEffect, useState } from 'react'
import type { AppSettings, ProjectBundle } from '../../shared/types'
import { LibraryView } from './components/LibraryView'
import { EditorView } from './components/EditorView'

export function App(): React.JSX.Element {
  const [project, setProject] = useState<ProjectBundle | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.speechDesk.settings.get().then((result) => {
      if (result.ok && result.data) setSettings(result.data)
    })
    const qaProject = new URLSearchParams(window.location.search).get('qaProject')
    if (qaProject) window.speechDesk.projects.load(qaProject).then((result) => {
      if (result.ok && result.data) setProject(result.data)
    })
  }, [])

  useEffect(() => {
    const theme = settings?.theme ?? 'system'
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme
    document.documentElement.dataset.theme = resolved
  }, [settings?.theme])

  return project
    ? <EditorView initialProject={project} settings={settings} onSettings={setSettings} onClose={() => setProject(null)} />
    : <LibraryView settings={settings} onSettings={setSettings} onOpen={setProject} />
}

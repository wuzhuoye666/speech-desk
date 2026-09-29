import { useEffect, useRef, useState } from 'react'
import { EyeOff, Lock, ShieldCheck, X } from 'lucide-react'
import type { PrompterState } from '../../../shared/types'
import { RichTextEditor } from './RichTextEditor'
import { MermaidDiagram } from './MermaidDiagram'
import { foldedText } from '../../../shared/graph'

export function PrompterView(): React.JSX.Element {
  const [state, setState] = useState<PrompterState | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const off = window.speechDesk.prompter.onState(setState)
    // The main process may have sent state before this listener was registered;
    // asking for the current state closes that race so the window always fills in.
    window.speechDesk.prompter.ready()
    return off
  }, [])
  useEffect(() => window.speechDesk.prompter.onScroll((direction) => {
    contentRef.current?.scrollBy({ top: direction === 'down' ? 120 : -120, behavior: 'smooth' })
  }), [])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === ' ' || event.key === 'ArrowRight') { event.preventDefault(); void window.speechDesk.presentation.navigate('next') }
      if (event.key === 'ArrowLeft') { event.preventDefault(); void window.speechDesk.presentation.navigate('previous') }
      if (event.key === 'PageDown') contentRef.current?.scrollBy({ top: 160, behavior: 'smooth' })
      if (event.key === 'PageUp') contentRef.current?.scrollBy({ top: -160, behavior: 'smooth' })
      if (event.key === 'Escape') void window.speechDesk.presentation.stop()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!contentRef.current) return
    const richContent = contentRef.current.querySelector<HTMLElement>('.rich-content, .mermaid-preview')
    if (!richContent) return
    const resize = (): void => {
      const contentHeight = Math.ceil(richContent.getBoundingClientRect().height)
      void window.speechDesk.prompter.resizeToContent(contentHeight + 46)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(richContent)
    requestAnimationFrame(resize)
    return () => observer.disconnect()
  }, [state?.currentNodeId])

  if (!state) return <div className="prompter-frame loading">正在准备提词内容…</div>
  const theme = state.settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : state.settings.theme
  return <div className={`prompter-frame ${theme} ${state.settings.clickThrough ? 'locked' : ''}`} style={{ '--prompter-scale': state.settings.fontScale } as React.CSSProperties}>
    <header className="prompter-header">
      <div className="prompter-title"><span>{state.title || '未命名节点'}</span><small>{state.position} / {state.total}</small></div>
      <div className="prompter-status">
        <span title="已请求捕获保护"><ShieldCheck /></span>
        {state.settings.clickThrough ? <span title="鼠标已穿透"><Lock /></span> : null}
        <button className="prompter-close" title="结束演讲 (Esc)" onClick={() => void window.speechDesk.presentation.stop()}><X /></button>
      </div>
    </header>
    <div className="prompter-content" ref={contentRef}>
      {state.kind === 'graph' ? <MermaidDiagram source={foldedText(state.content)} /> : <RichTextEditor content={state.content} projectId={state.projectId} editable={false} compact />}
    </div>
    {state.atEnd && <div className="end-marker"><EyeOff />已到最后一块</div>}
  </div>
}

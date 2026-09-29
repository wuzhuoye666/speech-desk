import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'

let initialized = false
let renderCounter = 0

export function MermaidDiagram({ source }: { source: string }): React.JSX.Element {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!source.trim()) { setSvg(''); setError('输入 Mermaid 图表代码'); return }
    const timer = window.setTimeout(async () => {
      try {
        const { default: mermaid } = await import('mermaid')
        if (!initialized) {
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, flowchart: { htmlLabels: false } })
          initialized = true
        }
        const result = await mermaid.render(`speechDiagram${++renderCounter}`, source)
        if (!cancelled) { setSvg(DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } })); setError('') }
      } catch (reason) {
        if (!cancelled) { setSvg(''); setError(reason instanceof Error ? reason.message : '图表语法错误') }
      }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [source])

  return <div className="mermaid-preview" aria-label="Mermaid 图表预览">
    {error ? <span className="mermaid-error">{error}</span> : <div dangerouslySetInnerHTML={{ __html: svg }} />}
  </div>
}

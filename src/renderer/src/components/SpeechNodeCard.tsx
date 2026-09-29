import { memo, useState } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { Flag, MoreHorizontal, Play, Trash2 } from 'lucide-react'
import type { JSONContent } from '@tiptap/core'
import type { FoldSplitRule } from '../../../shared/types'
import { foldedText, sentenceContent, splitSentences } from '../../../shared/graph'
import { RichTextEditor } from './RichTextEditor'
import { MermaidDiagram } from './MermaidDiagram'

export interface SpeechNodeData extends Record<string, unknown> {
  title: string
  kind: 'regular' | 'folded' | 'graph'
  splitRule: FoldSplitRule
  content: JSONContent
  projectId: string
  isStart: boolean
  onTitle: (id: string, title: string) => void
  onContent: (id: string, content: JSONContent) => void
  onSplitRule: (id: string, rule: FoldSplitRule) => void
  onSetStart: (id: string) => void
  onPresent: (id: string) => void
  onDelete: (id: string) => void
}

function SpeechNodeCardComponent({ id, data, selected }: NodeProps): React.JSX.Element {
  const value = data as SpeechNodeData
  const [editingTitle, setEditingTitle] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const source = foldedText(value.content)
  const sentences = value.kind === 'folded' ? splitSentences(source, value.splitRule) : []
  return <div className={`speech-node ${selected ? 'selected' : ''} ${value.isStart ? 'start-node' : ''}`}>
    <NodeResizer minWidth={300} minHeight={200} maxWidth={1400} maxHeight={2200} isVisible={selected} lineClassName="node-resize-line" handleClassName="node-resize-handle" />
    <Handle type="target" position={Position.Left} className="node-handle" />
    <header className="node-header drag-handle">
      {value.isStart && <span className="start-label"><Flag size={12} /> 起点</span>}
      {editingTitle ? <input
        className="node-title-input nodrag" value={value.title} aria-label="节点标题" autoFocus
        onChange={(event) => value.onTitle(id, event.target.value)}
        onMouseDown={(event) => event.stopPropagation()}
        onBlur={() => setEditingTitle(false)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') setEditingTitle(false) }}
      /> : <div className="node-title" title="拖动节点；双击修改标题" onDoubleClick={(event) => { event.stopPropagation(); setEditingTitle(true) }}>
        {value.title || '未命名节点'}
      </div>}
      <div className="node-actions nodrag">
        <button title="从此处演讲" onClick={() => value.onPresent(id)}><Play /></button>
        <details>
          <summary title="节点菜单"><MoreHorizontal /></summary>
          <div className="node-menu">
            <button onClick={() => value.onSetStart(id)}><Flag />设为起点</button>
            <button className="danger" onClick={() => value.onDelete(id)}><Trash2 />删除节点</button>
          </div>
        </details>
      </div>
    </header>
    <div className="node-editor nodrag nowheel">
      {value.kind === 'regular' && <RichTextEditor content={value.content} projectId={value.projectId} onChange={(content) => value.onContent(id, content)} />}
      {value.kind === 'folded' && <div className="special-node-content">
        <div className="fold-rule-row"><span>分段规则</span><div className="fold-rule-options" role="group" aria-label="折叠框分段规则">
          <button type="button" aria-pressed={value.splitRule === 'period'} className={value.splitRule === 'period' ? 'active' : ''} onClick={() => value.onSplitRule(id, 'period')}>句号</button>
          <button type="button" aria-pressed={value.splitRule === 'newline'} className={value.splitRule === 'newline' ? 'active' : ''} onClick={() => value.onSplitRule(id, 'newline')}>回车</button>
        </div></div>
        <textarea aria-label="折叠框讲稿" placeholder={value.splitRule === 'period' ? '粘贴讲稿，按句号自动分段' : '粘贴讲稿，每行作为一段'} value={source} onChange={(event) => value.onContent(id, sentenceContent([event.target.value]))} />
        <button className="fold-toggle" onClick={() => setExpanded((open) => !open)}>{expanded ? '收起分段' : '展开分段'} <span>{sentences.length} 段</span></button>
        {expanded && <div className="folded-sentences">{sentences.map((sentence, index) => <div key={index}><small>{index + 1}</small>{sentence}</div>)}</div>}
      </div>}
      {value.kind === 'graph' && <div className="special-node-content">
        <textarea aria-label="Mermaid 图表代码" spellCheck={false} placeholder={'graph TD\n  A[开始] --> B[结束]'} value={source} onChange={(event) => value.onContent(id, sentenceContent([event.target.value]))} />
        <MermaidDiagram source={source} />
      </div>}
    </div>
    <Handle type="source" position={Position.Right} className="node-handle" />
  </div>
}

export const SpeechNodeCard = memo(SpeechNodeCardComponent)

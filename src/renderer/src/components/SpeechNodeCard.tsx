import { memo, useState } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { Flag, MoreHorizontal, Play, Trash2 } from 'lucide-react'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from './RichTextEditor'

export interface SpeechNodeData extends Record<string, unknown> {
  title: string
  content: JSONContent
  projectId: string
  isStart: boolean
  onTitle: (id: string, title: string) => void
  onContent: (id: string, content: JSONContent) => void
  onSetStart: (id: string) => void
  onPresent: (id: string) => void
  onDelete: (id: string) => void
}

function SpeechNodeCardComponent({ id, data, selected }: NodeProps): React.JSX.Element {
  const value = data as SpeechNodeData
  const [editingTitle, setEditingTitle] = useState(false)
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
      <RichTextEditor content={value.content} projectId={value.projectId} onChange={(content) => value.onContent(id, content)} />
    </div>
    <Handle type="source" position={Position.Right} className="node-handle" />
  </div>
}

export const SpeechNodeCard = memo(SpeechNodeCardComponent)

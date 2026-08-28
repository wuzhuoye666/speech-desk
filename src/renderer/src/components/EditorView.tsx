import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, addEdge,
  applyEdgeChanges, applyNodeChanges, type Connection, type Edge, type EdgeChange, type Node, type NodeChange,
  type OnConnect, type ReactFlowInstance
} from '@xyflow/react'
import { ArrowLeft, CircleHelp, Download, Flag, Play, Plus, Settings, ShieldCheck } from 'lucide-react'
import type { AppSettings, ProjectBundle, SaveState, SpeechEdge, SpeechNode } from '../../../shared/types'
import { DEFAULT_CONTENT } from '../../../shared/types'
import { connectionErrorMessage, validateConnection } from '../../../shared/graph'
import { SpeechNodeCard, type SpeechNodeData } from './SpeechNodeCard'
import { SettingsModal } from './SettingsModal'

interface Props {
  initialProject: ProjectBundle
  settings: AppSettings | null
  onSettings: (settings: AppSettings) => void
  onClose: () => void
}

const nodeTypes = { speech: SpeechNodeCard }

export function EditorView(props: Props): React.JSX.Element {
  return <ReactFlowProvider><EditorCanvas {...props} /></ReactFlowProvider>
}

function EditorCanvas({ initialProject, settings, onSettings, onClose }: Props): React.JSX.Element {
  const [project, setProject] = useState(initialProject)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [toast, setToast] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const flowRef = useRef<ReactFlowInstance<Node<SpeechNodeData>, Edge> | null>(null)
  const initialized = useRef(false)

  const showToast = useCallback((message: string) => {
    setToast(message); window.setTimeout(() => setToast(null), 2600)
  }, [])

  const updateNode = useCallback((id: string, patch: Partial<SpeechNode>) => {
    setProject((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === id ? { ...node, ...patch, updatedAt: new Date().toISOString() } : node)
    }))
  }, [])

  const startPresentation = useCallback(async (startNodeId?: string) => {
    const saveResult = await window.speechDesk.projects.save(project)
    if (!saveResult.ok) { showToast(saveResult.error ?? '保存失败，无法开始演讲'); return }
    const result = await window.speechDesk.presentation.start({ projectId: project.presentation.id, startNodeId })
    if (!result.ok) showToast(result.error ?? '无法开始演讲')
    else showToast('提词窗已开启 · Alt+→ 切换下一块')
  }, [project, showToast])

  const deleteNode = useCallback((id: string) => {
    setProject((current) => ({
      presentation: { ...current.presentation, startNodeId: current.presentation.startNodeId === id ? null : current.presentation.startNodeId },
      nodes: current.nodes.filter((node) => node.id !== id),
      edges: current.edges.filter((edge) => edge.sourceNodeId !== id && edge.targetNodeId !== id)
    }))
  }, [])

  const flowNodes = useMemo<Node<SpeechNodeData>[]>(() => project.nodes.map((node) => ({
    id: node.id,
    type: 'speech',
    position: node.position,
    style: { width: node.size.width, height: node.size.height },
    measured: { width: node.size.width, height: node.size.height },
    dragHandle: '.drag-handle',
    data: {
      title: node.title,
      content: node.content,
      projectId: project.presentation.id,
      isStart: project.presentation.startNodeId === node.id,
      onTitle: (id, title) => updateNode(id, { title }),
      onContent: (id, content) => updateNode(id, { content }),
      onSetStart: (id) => setProject((current) => ({ ...current, presentation: { ...current.presentation, startNodeId: id } })),
      onPresent: startPresentation,
      onDelete: deleteNode
    }
  })), [project.nodes, project.presentation.id, project.presentation.startNodeId, updateNode, startPresentation, deleteNode])

  const flowEdges = useMemo<Edge[]>(() => project.edges.map((edge) => ({
    id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId
  })), [project.edges])

  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return }
    setSaveState('saving')
    const timer = window.setTimeout(async () => {
      const result = await window.speechDesk.projects.save(project)
      if (result.ok) { setSaveState('saved') }
      else { setSaveState('error'); showToast(result.error ?? '保存失败') }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [project, showToast])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setProject((current) => ({
      ...current,
      nodes: current.nodes
        .filter((node) => !changes.some((change) => change.type === 'remove' && change.id === node.id))
        .map((node) => {
          let next = node
          for (const change of changes) {
            if (!('id' in change) || change.id !== node.id) continue
            if (change.type === 'position' && change.position) next = { ...next, position: change.position }
            if (change.type === 'dimensions' && change.dimensions) {
              next = { ...next, size: { width: change.dimensions.width, height: change.dimensions.height } }
            }
          }
          return next
        }),
      edges: current.edges.filter((edge) =>
        !changes.some((change) => change.type === 'remove' && (change.id === edge.sourceNodeId || change.id === edge.targetNodeId))
      ),
      presentation: {
        ...current.presentation,
        startNodeId: current.presentation.startNodeId && changes.some((change) => change.type === 'remove' && change.id === current.presentation.startNodeId)
          ? null : current.presentation.startNodeId
      }
    }))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const next = applyEdgeChanges(changes, flowEdges)
    setProject((current) => ({
      ...current,
      edges: next.map((edge) => ({
        id: edge.id, presentationId: current.presentation.id, sourceNodeId: edge.source, targetNodeId: edge.target
      }))
    }))
  }, [flowEdges])

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    const error = validateConnection(project.nodes, project.edges, connection.source, connection.target)
    if (error) { showToast(connectionErrorMessage(error)); return }
    const edge: SpeechEdge = {
      id: crypto.randomUUID(), presentationId: project.presentation.id,
      sourceNodeId: connection.source, targetNodeId: connection.target
    }
    setProject((current) => ({ ...current, edges: [...current.edges, edge] }))
  }, [project, showToast])

  const addNode = useCallback((position?: { x: number; y: number }) => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const center = position ?? flowRef.current?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) ?? { x: 120, y: 120 }
    const node: SpeechNode = {
      id, presentationId: project.presentation.id, title: '新演讲块', content: structuredClone(DEFAULT_CONTENT),
      position: center, size: { width: 440, height: 280 }, createdAt: now, updatedAt: now
    }
    setProject((current) => ({
      ...current,
      presentation: { ...current.presentation, startNodeId: current.presentation.startNodeId ?? id },
      nodes: [...current.nodes, node]
    }))
  }, [project.presentation.id])

  const onMoveEnd = useCallback((_event: MouseEvent | TouchEvent | null, viewport: { x: number; y: number; zoom: number }) => {
    setProject((current) => ({ ...current, presentation: { ...current.presentation, viewport } }))
  }, [])

  const exportProject = async (): Promise<void> => {
    const saveResult = await window.speechDesk.projects.save(project)
    if (!saveResult.ok) { showToast(saveResult.error ?? '保存失败'); return }
    const result = await window.speechDesk.backup.export(project.presentation.id)
    if (!result.ok) showToast(result.error ?? '导出失败')
    else if (result.data) showToast('备份已导出')
  }

  return <div className="app-shell editor-shell">
    <header className="topbar">
      <button className="icon-button" title="返回资料库" onClick={async () => { await window.speechDesk.projects.save(project); onClose() }}><ArrowLeft /></button>
      <div className="project-heading">
        <input value={project.presentation.title} onChange={(event) => setProject((current) => ({ ...current, presentation: { ...current.presentation, title: event.target.value } }))} />
        <span className={`save-state ${saveState}`}>{saveState === 'saving' ? '保存中…' : saveState === 'error' ? '保存失败' : '已保存'}</span>
      </div>
      <div className="topbar-spacer" />
      <span className="privacy-note" title="提词窗会请求 Windows 排除捕获，但无法保证兼容全部录屏工具"><ShieldCheck />尽力隐藏共享</span>
      <button className="secondary-button" onClick={exportProject}><Download />导出备份</button>
      <button className="icon-button" title="设置" onClick={() => setSettingsOpen(true)}><Settings /></button>
      <button className="primary-button" onClick={() => void startPresentation()}><Play />开始演讲</button>
    </header>
    <main className="canvas-wrap" data-edge-count={project.edges.length}>
      <ReactFlow
        nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onInit={(instance) => { flowRef.current = instance }} onMoveEnd={onMoveEnd}
        onDoubleClick={(event) => {
          if (event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('react-flow__pane')) {
            addNode(flowRef.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY }))
          }
        }}
        defaultViewport={project.presentation.viewport}
        minZoom={0.2} maxZoom={2.2} fitView={false} deleteKeyCode={['Backspace', 'Delete']}
        selectionOnDrag panOnScroll zoomOnPinch elevateEdgesOnSelect
        connectionLineStyle={{ stroke: 'var(--edge-color)', strokeWidth: 2 }}
        defaultEdgeOptions={{ type: 'smoothstep', zIndex: 3 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(node) => node.data.isStart ? '#4d8064' : '#989895'} />
      </ReactFlow>
      <div className="canvas-actions">
        <button className="primary-button" onClick={() => addNode()}><Plus />新建节点</button>
        {!project.presentation.startNodeId && <span className="canvas-warning"><Flag />请设置演讲起点</span>}
      </div>
      <div className="canvas-hint"><CircleHelp />双击空白处创建节点 · 拖动节点两侧圆点建立顺序</div>
    </main>
    {toast && <div className="toast">{toast}</div>}
    {settingsOpen && settings && <SettingsModal settings={settings} onChange={onSettings} onClose={() => setSettingsOpen(false)} />}
  </div>
}

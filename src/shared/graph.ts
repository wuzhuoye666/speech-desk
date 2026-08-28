import type { SpeechEdge, SpeechNode } from './types'

export type ConnectionError = 'self' | 'duplicate' | 'source-used' | 'target-used' | 'cycle' | 'missing-node'

export function validateConnection(
  nodes: Pick<SpeechNode, 'id'>[],
  edges: Pick<SpeechEdge, 'sourceNodeId' | 'targetNodeId'>[],
  sourceNodeId: string,
  targetNodeId: string
): ConnectionError | null {
  if (sourceNodeId === targetNodeId) return 'self'
  const ids = new Set(nodes.map((node) => node.id))
  if (!ids.has(sourceNodeId) || !ids.has(targetNodeId)) return 'missing-node'
  if (edges.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId)) return 'duplicate'
  if (edges.some((edge) => edge.sourceNodeId === sourceNodeId)) return 'source-used'
  if (edges.some((edge) => edge.targetNodeId === targetNodeId)) return 'target-used'

  const nextByNode = new Map(edges.map((edge) => [edge.sourceNodeId, edge.targetNodeId]))
  nextByNode.set(sourceNodeId, targetNodeId)
  let cursor: string | undefined = targetNodeId
  const visited = new Set<string>()
  while (cursor) {
    if (cursor === sourceNodeId) return 'cycle'
    if (visited.has(cursor)) return 'cycle'
    visited.add(cursor)
    cursor = nextByNode.get(cursor)
  }
  return null
}

export function buildPlaybackChain(nodes: SpeechNode[], edges: SpeechEdge[], startNodeId: string | null): SpeechNode[] {
  if (!startNodeId) return []
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const nextById = new Map(edges.map((edge) => [edge.sourceNodeId, edge.targetNodeId]))
  const chain: SpeechNode[] = []
  const visited = new Set<string>()
  let cursor: string | undefined = startNodeId
  while (cursor && !visited.has(cursor)) {
    const node = nodeById.get(cursor)
    if (!node) break
    chain.push(node)
    visited.add(cursor)
    cursor = nextById.get(cursor)
  }
  return chain
}

export function connectionErrorMessage(error: ConnectionError): string {
  return {
    self: '节点不能连接到自己',
    duplicate: '这条连线已经存在',
    'source-used': '每个节点只能有一个下一节点',
    'target-used': '每个节点只能有一个上一节点',
    cycle: '连线不能形成循环',
    'missing-node': '连线节点不存在'
  }[error]
}

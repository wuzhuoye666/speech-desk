import { describe, expect, it } from 'vitest'
import { buildPlaybackChain, validateConnection } from './graph'
import type { SpeechEdge, SpeechNode } from './types'

const node = (id: string): SpeechNode => ({
  id, presentationId: 'p', title: id, content: { type: 'doc' }, position: { x: 0, y: 0 },
  size: { width: 400, height: 240 }, createdAt: '', updatedAt: ''
})
const edge = (sourceNodeId: string, targetNodeId: string): SpeechEdge => ({ id: `${sourceNodeId}-${targetNodeId}`, presentationId: 'p', sourceNodeId, targetNodeId })

describe('validateConnection', () => {
  const nodes = [node('a'), node('b'), node('c')]
  it('accepts a valid linear connection', () => expect(validateConnection(nodes, [], 'a', 'b')).toBeNull())
  it('rejects self connections', () => expect(validateConnection(nodes, [], 'a', 'a')).toBe('self'))
  it('rejects a second successor', () => expect(validateConnection(nodes, [edge('a', 'b')], 'a', 'c')).toBe('source-used'))
  it('rejects a second predecessor', () => expect(validateConnection(nodes, [edge('a', 'c')], 'b', 'c')).toBe('target-used'))
  it('rejects cycles', () => expect(validateConnection(nodes, [edge('a', 'b'), edge('b', 'c')], 'c', 'a')).toBe('cycle'))
})

describe('buildPlaybackChain', () => {
  it('follows only the reachable linear path', () => {
    const nodes = [node('a'), node('b'), node('c'), node('unused')]
    expect(buildPlaybackChain(nodes, [edge('a', 'b'), edge('b', 'c')], 'a').map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
  it('returns an empty chain without a start node', () => expect(buildPlaybackChain([node('a')], [], null)).toEqual([]))
  it('stops safely if persisted data contains a cycle', () => {
    expect(buildPlaybackChain([node('a'), node('b')], [edge('a', 'b'), edge('b', 'a')], 'a').map((item) => item.id)).toEqual(['a', 'b'])
  })
})

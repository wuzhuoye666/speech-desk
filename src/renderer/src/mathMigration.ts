import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

interface MathReplacement {
  from: number
  to: number
  latex: string
  kind: 'inline' | 'block'
}

const BLOCK_MATH = /^\s*(?:\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$)\s*$/
const INLINE_MATH = /\\\((.+?)\\\)|(?<!\$)\$(?!\$|\d+\$)(.+?)\$(?!\$|\d)/g

export function migrateAllMathDelimiters(editor: Editor): void {
  const { inlineMath, blockMath } = editor.schema.nodes
  if (!inlineMath || !blockMath) return

  const replacements: MathReplacement[] = []
  editor.state.doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === 'paragraph') {
      const block = node.textContent.match(BLOCK_MATH)
      if (block) {
        replacements.push({ from: pos, to: pos + node.nodeSize, latex: (block[1] ?? block[2]).trim(), kind: 'block' })
        return false
      }
    }
    if (!node.isText || !node.text) return
    INLINE_MATH.lastIndex = 0
    for (const match of node.text.matchAll(INLINE_MATH)) {
      if (match.index === undefined) continue
      replacements.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
        latex: (match[1] ?? match[2]).trim(),
        kind: 'inline'
      })
    }
  })

  if (!replacements.length) return
  const transaction = editor.state.tr
  for (const replacement of replacements.sort((a, b) => b.from - a.from)) {
    const mathNode = replacement.kind === 'block' ? blockMath : inlineMath
    transaction.replaceWith(replacement.from, replacement.to, mathNode.create({ latex: replacement.latex }))
  }
  transaction.setMeta('addToHistory', false)
  editor.view.dispatch(transaction)
}

export function containsSupportedMathDelimiter(value: string): boolean {
  INLINE_MATH.lastIndex = 0
  return BLOCK_MATH.test(value) || INLINE_MATH.test(value)
}

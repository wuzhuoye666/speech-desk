// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorExtensions } from './editorExtensions'
import { migrateAllMathDelimiters } from './mathMigration'

let editor: Editor | null = null
afterEach(() => { editor?.destroy(); editor = null })

describe('migrateAllMathDelimiters', () => {
  it('turns parenthesized AI LaTeX into an inline math node', () => {
    editor = new Editor({
      extensions: editorExtensions,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: String.raw`\(V = S_t - \dfrac{F_0}{(1+r)^T}\)` }] }] }
    })
    migrateAllMathDelimiters(editor)
    const json = editor.getJSON()
    expect(json.content?.[0].content?.[0]).toMatchObject({ type: 'inlineMath', attrs: { latex: String.raw`V = S_t - \dfrac{F_0}{(1+r)^T}` } })
  })

  it('turns bracketed AI LaTeX into a block math node', () => {
    editor = new Editor({
      extensions: editorExtensions,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: String.raw`\[E = mc^2\]` }] }] }
    })
    migrateAllMathDelimiters(editor)
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'blockMath', attrs: { latex: 'E = mc^2' } })
  })
})

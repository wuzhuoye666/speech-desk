import { describe, expect, it } from 'vitest'
import { looksLikeMarkdown } from './markdown'

describe('looksLikeMarkdown', () => {
  it.each(['# 标题\n正文', '- 第一项\n- 第二项', '```ts\nconst x = 1\n```', '| A | B |\n| - | - |', '$$x^2$$'])(
    'detects structured markdown: %s',
    (value) => expect(looksLikeMarkdown(value)).toBe(true)
  )
  it.each(['今天的演讲分成三个部分。', '你好', '价格是 $20。'])(
    'leaves normal prose untouched: %s',
    (value) => expect(looksLikeMarkdown(value)).toBe(false)
  )
})

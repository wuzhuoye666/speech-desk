import { describe, expect, it } from 'vitest'
import { containsSupportedMathDelimiter } from './mathMigration'

describe('containsSupportedMathDelimiter', () => {
  it.each([
    String.raw`\(V = S_t - \dfrac{F_0}{(1+r)^T}\)`,
    String.raw`\[E = mc^2\]`,
    '$x^2 + y^2$',
    '$$\\frac{a}{b}$$'
  ])('recognizes AI math delimiters: %s', (value) => expect(containsSupportedMathDelimiter(value)).toBe(true))

  it.each(['价格是 100 元', '$100', '普通文本（没有反斜杠）'])(
    'does not treat prose as math: %s',
    (value) => expect(containsSupportedMathDelimiter(value)).toBe(false)
  )
})

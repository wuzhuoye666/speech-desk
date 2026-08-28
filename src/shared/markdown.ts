const MARKDOWN_PATTERNS = [
  /^#{1,6}\s+.+/m,
  /^\s*[-*+]\s+.+/m,
  /^\s*\d+\.\s+.+/m,
  /```[\s\S]*```/m,
  /^>\s+.+/m,
  /^\|.+\|\s*$/m,
  /\*\*[^*]+\*\*/,
  /\$\$[\s\S]+\$\$/
]

export function looksLikeMarkdown(value: string): boolean {
  if (value.trim().length < 4) return false
  return MARKDOWN_PATTERNS.filter((pattern) => pattern.test(value)).length >= 1
}

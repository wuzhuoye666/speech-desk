import { useCallback, useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { Bold, Braces, Code2, Heading2, ImagePlus, Italic, List, ListOrdered, Quote, Sigma, Strikethrough, Table2 } from 'lucide-react'
import type { JSONContent } from '@tiptap/core'
import { editorExtensions } from '../editorExtensions'
import { looksLikeMarkdown } from '../../../shared/markdown'
import { migrateAllMathDelimiters } from '../mathMigration'

interface Props {
  content: JSONContent
  projectId: string
  onChange?: (content: JSONContent) => void
  editable?: boolean
  compact?: boolean
}

export function RichTextEditor({ content, projectId, onChange, editable = true, compact = false }: Props): React.JSX.Element {
  const editor = useEditor({
    extensions: editorExtensions,
    content,
    editable,
    onCreate: ({ editor }) => queueMicrotask(() => migrateAllMathDelimiters(editor)),
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
    editorProps: {
      attributes: { class: compact ? 'rich-content compact' : 'rich-content nodrag nowheel' },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'))
        if (files[0]) {
          void importImage(files[0], projectId).then((url) => {
            if (url) editor?.chain().focus().setImage({ src: url, alt: files[0].name }).run()
          })
          return true
        }
        const text = event.clipboardData?.getData('text/plain') ?? ''
        const html = event.clipboardData?.getData('text/html') ?? ''
        if (html) {
          const sanitized = DOMPurify.sanitize(html, {
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
            FORBID_ATTR: ['style', 'class', 'id', 'onerror', 'onclick']
          })
          editor?.commands.insertContent(sanitized)
          queueMicrotask(() => editor && migrateAllMathDelimiters(editor))
          return true
        }
        if (looksLikeMarkdown(text)) {
          const rendered = marked.parse(text, { async: false }) as string
          editor?.commands.insertContent(DOMPurify.sanitize(rendered, { FORBID_TAGS: ['script', 'style', 'iframe'] }))
          queueMicrotask(() => editor && migrateAllMathDelimiters(editor))
          return true
        }
        return false
      },
      handleDrop: (_view, event) => {
        const file = Array.from(event.dataTransfer?.files ?? []).find((item) => item.type.startsWith('image/'))
        if (!file) return false
        void importImage(file, projectId).then((url) => {
          if (url) editor?.chain().focus().setImage({ src: url, alt: file.name }).run()
        })
        return true
      }
    }
  }, [editable, projectId])

  const addImage = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) void importImage(file, projectId).then((url) => url && editor?.chain().focus().setImage({ src: url, alt: file.name }).run())
    }
    input.click()
  }, [editor, projectId])

  useEffect(() => {
    if (editor && !editable && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
      editor.commands.setContent(content, { emitUpdate: false })
      queueMicrotask(() => migrateAllMathDelimiters(editor))
    }
  }, [content, editable, editor])

  if (!editor) return <div className="editor-loading">正在载入编辑器…</div>

  return <div className={`rich-editor ${editable ? '' : 'read-only'}`}>
    {editable && <div className="format-bar nodrag">
      <Tool title="标题" active={editor.isActive('heading')} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></Tool>
      <Tool title="粗体" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></Tool>
      <Tool title="斜体" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></Tool>
      <Tool title="删除线" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></Tool>
      <Tool title="无序列表" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></Tool>
      <Tool title="有序列表" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Tool>
      <Tool title="引用" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Tool>
      <Tool title="行内代码" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code2 /></Tool>
      <Tool title="代码块" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Braces /></Tool>
      <Tool title="表格" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 /></Tool>
      <Tool title="公式" onClick={() => {
        const latex = window.prompt('输入 LaTeX 公式', 'E = mc^2')
        if (latex) editor.chain().focus().insertInlineMath({ latex }).run()
      }}><Sigma /></Tool>
      <Tool title="图片" onClick={addImage}><ImagePlus /></Tool>
    </div>}
    <EditorContent editor={editor} />
  </div>
}

function Tool({ title, active, onClick, children }: { title: string; active?: boolean; onClick: () => void; children: React.ReactNode }): React.JSX.Element {
  return <button type="button" className={active ? 'active' : ''} title={title} onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); onClick() }}>{children}</button>
}

async function importImage(file: File, projectId: string): Promise<string | null> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const result = await window.speechDesk.assets.import({ projectId, name: file.name || '粘贴的图片.png', mimeType: file.type || 'image/png', bytes })
  return result.ok ? result.data ?? null : null
}

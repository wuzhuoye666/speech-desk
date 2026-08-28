import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Mathematics from '@tiptap/extension-mathematics'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { common, createLowlight } from 'lowlight'

const lowlight = createLowlight(common)

export const editorExtensions = [
  StarterKit.configure({ codeBlock: false, link: false }),
  Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
  Image.configure({ allowBase64: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  CodeBlockLowlight.configure({ lowlight }),
  Mathematics.configure({ katexOptions: { throwOnError: false } })
]

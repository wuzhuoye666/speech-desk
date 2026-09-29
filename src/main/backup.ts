import AdmZip from 'adm-zip'
import { dialog } from 'electron'
import { basename, extname } from 'node:path'
import { readFileSync } from 'node:fs'
import type { ProjectBundle } from '../shared/types'
import { projectBundleSchema } from '../shared/schemas'
import type { SpeechDatabase } from './database'

const BACKUP_VERSION = 1
const MAX_BACKUP_BYTES = 150 * 1024 * 1024

export async function exportProject(db: SpeechDatabase, id: string): Promise<string | null> {
  const project = db.loadProject(id)
  const result = await dialog.showSaveDialog({
    title: '导出演讲备份',
    defaultPath: `${safeName(project.presentation.title)}.speechdesk`,
    filters: [{ name: 'Talk2 项目', extensions: ['speechdesk'] }]
  })
  if (result.canceled || !result.filePath) return null
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify({ version: BACKUP_VERSION, exportedAt: new Date().toISOString() })))
  zip.addFile('project.json', Buffer.from(JSON.stringify(project)))
  for (const asset of db.listAssets(id)) {
    zip.addFile(`assets/${asset.id}${extname(asset.name).slice(0, 12)}`, readFileSync(asset.filePath), '', 0o644 << 16)
    zip.addFile(`assets/${asset.id}.meta.json`, Buffer.from(JSON.stringify({ name: asset.name, mimeType: asset.mimeType })))
  }
  zip.writeZip(result.filePath)
  return result.filePath
}

export async function importProject(db: SpeechDatabase): Promise<ProjectBundle | null> {
  const result = await dialog.showOpenDialog({
    title: '导入演讲备份', properties: ['openFile'], filters: [{ name: 'Talk2 项目', extensions: ['speechdesk'] }]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const zip = new AdmZip(result.filePaths[0])
  const entries = zip.getEntries()
  let total = 0
  for (const entry of entries) {
    total += entry.header.size
    if (total > MAX_BACKUP_BYTES) throw new Error('备份包超过 150MB')
    if (entry.entryName.includes('..') || entry.entryName.startsWith('/') || entry.entryName.includes('\\')) throw new Error('备份包包含不安全路径')
  }
  const manifestEntry = zip.getEntry('manifest.json')
  const projectEntry = zip.getEntry('project.json')
  if (!manifestEntry || !projectEntry) throw new Error('备份包缺少必要文件')
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8')) as { version?: number }
  if (manifest.version !== BACKUP_VERSION) throw new Error('暂不支持这个备份版本')
  const source = projectBundleSchema.parse(JSON.parse(projectEntry.getData().toString('utf8'))) as ProjectBundle
  const assets: Array<{ oldId: string; name: string; mimeType: string; bytes: Uint8Array }> = []
  for (const entry of entries.filter((item) => /^assets\/[a-f0-9-]+\.meta\.json$/i.test(item.entryName))) {
    const oldId = entry.entryName.slice('assets/'.length, -'.meta.json'.length)
    const meta = JSON.parse(entry.getData().toString('utf8')) as { name?: string; mimeType?: string }
    const dataEntry = entries.find((item) => item.entryName.startsWith(`assets/${oldId}`) && !item.entryName.endsWith('.meta.json'))
    if (dataEntry && meta.name && meta.mimeType?.startsWith('image/')) {
      assets.push({ oldId, name: meta.name, mimeType: meta.mimeType, bytes: dataEntry.getData() })
    }
  }
  return db.cloneProject(source, `${source.presentation.title}（导入）`, assets)
}

function safeName(name: string): string {
  return basename(name.replace(/[<>:"/\\|?*]/g, '-').trim() || '未命名演讲').slice(0, 80)
}

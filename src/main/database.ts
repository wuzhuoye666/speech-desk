import { app } from 'electron'
import Database from 'better-sqlite3'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AppSettings, ProjectBundle, ProjectSummary } from '../shared/types'
import { DEFAULT_CONTENT, DEFAULT_SETTINGS } from '../shared/types'

type Row = Record<string, unknown>

export class SpeechDatabase {
  private readonly db: Database.Database
  readonly assetsDir: string

  constructor() {
    const dataDir = app.getPath('userData')
    mkdirSync(dataDir, { recursive: true })
    this.assetsDir = join(dataDir, 'assets')
    mkdirSync(this.assetsDir, { recursive: true })
    this.db = new Database(join(dataDir, 'speech-desk.sqlite'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS presentations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        start_node_id TEXT,
        viewport_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS speech_nodes (
        id TEXT PRIMARY KEY,
        presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content_json TEXT NOT NULL,
        position_json TEXT NOT NULL,
        size_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS speech_edges (
        id TEXT PRIMARY KEY,
        presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        UNIQUE(presentation_id, source_node_id),
        UNIQUE(presentation_id, target_node_id)
      );
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
      INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
    `)
    const columns = this.db.pragma('table_info(speech_nodes)') as { name: string }[]
    if (!columns.some((column) => column.name === 'kind')) {
      this.db.exec("ALTER TABLE speech_nodes ADD COLUMN kind TEXT NOT NULL DEFAULT 'regular'")
    }
    if (!columns.some((column) => column.name === 'split_rule')) {
      this.db.exec("ALTER TABLE speech_nodes ADD COLUMN split_rule TEXT NOT NULL DEFAULT 'period'")
    }
  }

  listProjects(trashed = false): ProjectSummary[] {
    const rows = this.db.prepare(`
      SELECT p.*, COUNT(n.id) AS node_count
      FROM presentations p LEFT JOIN speech_nodes n ON n.presentation_id = p.id
      WHERE p.deleted_at IS ${trashed ? 'NOT NULL' : 'NULL'}
      GROUP BY p.id ORDER BY p.updated_at DESC
    `).all() as Row[]
    return rows.map((row) => ({ ...this.rowToPresentation(row), nodeCount: Number(row.node_count) }))
  }

  createProject(title = '未命名演讲'): ProjectBundle {
    const now = new Date().toISOString()
    const projectId = randomUUID()
    const nodeId = randomUUID()
    const project: ProjectBundle = {
      presentation: {
        id: projectId,
        title: title.trim() || '未命名演讲',
        startNodeId: nodeId,
        viewport: { x: 80, y: 80, zoom: 1 },
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      },
      nodes: [{
        id: nodeId,
        presentationId: projectId,
        title: '开场',
        content: structuredClone(DEFAULT_CONTENT),
        position: { x: 80, y: 80 },
        size: { width: 440, height: 280 },
        createdAt: now,
        updatedAt: now
      }],
      edges: []
    }
    return this.saveProject(project)
  }

  loadProject(id: string): ProjectBundle {
    const row = this.db.prepare('SELECT * FROM presentations WHERE id = ?').get(id) as Row | undefined
    if (!row) throw new Error('项目不存在')
    const nodes = (this.db.prepare('SELECT * FROM speech_nodes WHERE presentation_id = ?').all(id) as Row[]).map(this.rowToNode)
    const edges = (this.db.prepare('SELECT * FROM speech_edges WHERE presentation_id = ?').all(id) as Row[]).map(this.rowToEdge)
    return { presentation: this.rowToPresentation(row), nodes, edges }
  }

  saveProject(project: ProjectBundle): ProjectBundle {
    const save = this.db.transaction((bundle: ProjectBundle) => {
      const updatedAt = new Date().toISOString()
      const presentation = { ...bundle.presentation, updatedAt }
      this.db.prepare(`
        INSERT INTO presentations(id,title,start_node_id,viewport_json,created_at,updated_at,deleted_at)
        VALUES (@id,@title,@startNodeId,@viewport,@createdAt,@updatedAt,@deletedAt)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title,start_node_id=excluded.start_node_id,
          viewport_json=excluded.viewport_json,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
      `).run({ ...presentation, viewport: JSON.stringify(presentation.viewport) })

      this.db.prepare('DELETE FROM speech_edges WHERE presentation_id = ?').run(presentation.id)
      this.db.prepare('DELETE FROM speech_nodes WHERE presentation_id = ?').run(presentation.id)
      const insertNode = this.db.prepare(`
        INSERT INTO speech_nodes(id,presentation_id,title,kind,split_rule,content_json,position_json,size_json,created_at,updated_at)
        VALUES (@id,@presentationId,@title,@kind,@splitRule,@content,@position,@size,@createdAt,@updatedAt)
      `)
      for (const node of bundle.nodes) insertNode.run({
        ...node,
        kind: node.kind ?? 'regular',
        splitRule: node.splitRule ?? 'period',
        presentationId: presentation.id,
        content: JSON.stringify(node.content),
        position: JSON.stringify(node.position),
        size: JSON.stringify(node.size),
        updatedAt
      })
      const insertEdge = this.db.prepare(`
        INSERT INTO speech_edges(id,presentation_id,source_node_id,target_node_id)
        VALUES (@id,@presentationId,@sourceNodeId,@targetNodeId)
      `)
      for (const edge of bundle.edges) insertEdge.run({ ...edge, presentationId: presentation.id })
      return { ...bundle, presentation, nodes: bundle.nodes.map((node) => ({ ...node, updatedAt })) }
    })
    return save(project)
  }

  renameProject(id: string, title: string): void {
    const result = this.db.prepare('UPDATE presentations SET title=?, updated_at=? WHERE id=?')
      .run(title.trim() || '未命名演讲', new Date().toISOString(), id)
    if (!result.changes) throw new Error('项目不存在')
  }

  duplicateProject(id: string): ProjectBundle {
    const source = this.loadProject(id)
    const assets = this.listAssets(id).map((asset) => ({ oldId: asset.id, name: asset.name, mimeType: asset.mimeType, bytes: readFileSync(asset.filePath) }))
    return this.cloneProject(source, `${source.presentation.title} 副本`, assets)
  }

  cloneProject(
    source: ProjectBundle,
    title = source.presentation.title,
    assets: Array<{ oldId: string; name: string; mimeType: string; bytes: Uint8Array }> = []
  ): ProjectBundle {
    const now = new Date().toISOString()
    const projectId = randomUUID()
    const nodeIds = new Map(source.nodes.map((node) => [node.id, randomUUID()]))
    const bundle: ProjectBundle = {
      presentation: {
        ...source.presentation,
        id: projectId,
        title,
        startNodeId: source.presentation.startNodeId ? nodeIds.get(source.presentation.startNodeId) ?? null : null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      },
      nodes: source.nodes.map((node) => ({
        ...node,
        id: nodeIds.get(node.id)!,
        presentationId: projectId,
        createdAt: now,
        updatedAt: now
      })),
      edges: source.edges.map((edge) => ({
        ...edge,
        id: randomUUID(),
        presentationId: projectId,
        sourceNodeId: nodeIds.get(edge.sourceNodeId)!,
        targetNodeId: nodeIds.get(edge.targetNodeId)!
      }))
    }
    let saved = this.saveProject(bundle)
    if (assets.length) {
      const urlMap = new Map<string, string>()
      const dir = join(this.assetsDir, projectId)
      mkdirSync(dir, { recursive: true })
      for (const asset of assets) {
        const fileId = randomUUID()
        const extension = safeAssetExtension(asset.name, asset.mimeType)
        const filePath = join(dir, `${fileId}${extension}`)
        writeFileSync(filePath, Buffer.from(asset.bytes))
        const newId = this.addAsset({ projectId, name: asset.name, mimeType: asset.mimeType, filePath })
        urlMap.set(`speech-asset://asset/${asset.oldId}`, `speech-asset://asset/${newId}`)
      }
      saved = this.saveProject({
        ...saved,
        nodes: saved.nodes.map((node) => ({ ...node, content: rewriteAssetUrls(node.content, urlMap) }))
      })
    }
    return saved
  }

  moveToTrash(id: string): void {
    this.setDeletedAt(id, new Date().toISOString())
  }

  restore(id: string): void {
    this.setDeletedAt(id, null)
  }

  private setDeletedAt(id: string, value: string | null): void {
    const result = this.db.prepare('UPDATE presentations SET deleted_at=?, updated_at=? WHERE id=?')
      .run(value, new Date().toISOString(), id)
    if (!result.changes) throw new Error('项目不存在')
  }

  removeForever(id: string): void {
    const assets = this.db.prepare('SELECT file_path FROM assets WHERE presentation_id=?').all(id) as { file_path: string }[]
    this.db.prepare('DELETE FROM presentations WHERE id=?').run(id)
    for (const asset of assets) rmSync(asset.file_path, { force: true })
  }

  getSettings(): AppSettings {
    const row = this.db.prepare("SELECT value_json FROM settings WHERE key='app'").get() as { value_json: string } | undefined
    if (!row) return structuredClone(DEFAULT_SETTINGS)
    return { ...structuredClone(DEFAULT_SETTINGS), ...JSON.parse(row.value_json) } as AppSettings
  }

  saveSettings(settings: AppSettings): AppSettings {
    this.db.prepare("INSERT INTO settings(key,value_json) VALUES ('app',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json")
      .run(JSON.stringify(settings))
    return settings
  }

  addAsset(input: { projectId: string; name: string; mimeType: string; filePath: string }): string {
    const assetId = randomUUID()
    this.db.prepare('INSERT INTO assets(id,presentation_id,name,mime_type,file_path,created_at) VALUES (?,?,?,?,?,?)')
      .run(assetId, input.projectId, input.name, input.mimeType, input.filePath, new Date().toISOString())
    return assetId
  }

  getAsset(assetId: string): { id: string; presentationId: string; name: string; mimeType: string; filePath: string } | null {
    const row = this.db.prepare('SELECT * FROM assets WHERE id=?').get(assetId) as Row | undefined
    return row ? {
      id: String(row.id), presentationId: String(row.presentation_id), name: String(row.name),
      mimeType: String(row.mime_type), filePath: String(row.file_path)
    } : null
  }

  listAssets(projectId: string): { id: string; name: string; mimeType: string; filePath: string }[] {
    return (this.db.prepare('SELECT * FROM assets WHERE presentation_id=?').all(projectId) as Row[]).map((row) => ({
      id: String(row.id), name: String(row.name), mimeType: String(row.mime_type), filePath: String(row.file_path)
    }))
  }

  private rowToPresentation(row: Row): ProjectBundle['presentation'] {
    return {
      id: String(row.id), title: String(row.title), startNodeId: row.start_node_id ? String(row.start_node_id) : null,
      viewport: JSON.parse(String(row.viewport_json)), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      deletedAt: row.deleted_at ? String(row.deleted_at) : null
    }
  }

  private rowToNode = (row: Row): ProjectBundle['nodes'][number] => ({
    id: String(row.id), presentationId: String(row.presentation_id), title: String(row.title),
    kind: row.kind === 'folded' || row.kind === 'graph' ? row.kind : 'regular',
    splitRule: row.split_rule === 'newline' ? 'newline' : 'period',
    content: JSON.parse(String(row.content_json)), position: JSON.parse(String(row.position_json)),
    size: JSON.parse(String(row.size_json)), createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  })

  private rowToEdge = (row: Row): ProjectBundle['edges'][number] => ({
    id: String(row.id), presentationId: String(row.presentation_id),
    sourceNodeId: String(row.source_node_id), targetNodeId: String(row.target_node_id)
  })
}

function safeAssetExtension(name: string, mimeType: string): string {
  const extension = extname(name).toLowerCase()
  if (/^\.(png|jpe?g|gif|webp|svg)$/.test(extension)) return extension
  return { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' }[mimeType] ?? '.img'
}

function rewriteAssetUrls<T>(value: T, replacements: Map<string, string>): T {
  if (typeof value === 'string') return (replacements.get(value) ?? value) as T
  if (Array.isArray(value)) return value.map((item) => rewriteAssetUrls(item, replacements)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteAssetUrls(item, replacements)])) as T
  }
  return value
}

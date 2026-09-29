import { z } from 'zod'

const id = z.string().min(1).max(128)
const isoDate = z.string().min(1).max(64)

export const jsonContentSchema: z.ZodType<Record<string, unknown>> = z.record(z.string(), z.unknown())

export const speechNodeSchema = z.object({
  id,
  presentationId: id,
  title: z.string().max(200),
  kind: z.enum(['regular', 'folded', 'graph']).optional(),
  splitRule: z.enum(['period', 'newline']).optional(),
  content: jsonContentSchema,
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  size: z.object({ width: z.number().min(280).max(2400), height: z.number().min(180).max(4000) }),
  createdAt: isoDate,
  updatedAt: isoDate
})

export const speechEdgeSchema = z.object({
  id,
  presentationId: id,
  sourceNodeId: id,
  targetNodeId: id
})

export const presentationSchema = z.object({
  id,
  title: z.string().min(1).max(200),
  startNodeId: id.nullable(),
  viewport: z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().min(0.1).max(4) }),
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: isoDate.nullable()
})

export const projectBundleSchema = z.object({
  presentation: presentationSchema,
  nodes: z.array(speechNodeSchema).max(2000),
  edges: z.array(speechEdgeSchema).max(2000)
})

export const prompterSettingsSchema = z.object({
  displayId: z.string().nullable(),
  bounds: z.object({ x: z.number(), y: z.number(), width: z.number().min(320), height: z.number().min(100) }).nullable(),
  maxHeightRatio: z.number().min(0.2).max(0.7),
  fontScale: z.number().min(0.7).max(2.5),
  opacity: z.number().min(0.45).max(1),
  theme: z.enum(['system', 'light', 'dark']),
  clickThrough: z.boolean(),
  contentProtection: z.boolean()
})

export const hotkeySettingsSchema = z.object({
  next: z.string().min(1).max(64),
  previous: z.string().min(1).max(64),
  scrollUp: z.string().min(1).max(64),
  scrollDown: z.string().min(1).max(64),
  toggleVisibility: z.string().min(1).max(64),
  toggleClickThrough: z.string().min(1).max(64)
})

export const assetImportSchema = z.object({
  projectId: id,
  name: z.string().min(1).max(255),
  mimeType: z.string().regex(/^image\//).max(100),
  bytes: z.instanceof(Uint8Array).refine((value) => value.byteLength <= 20 * 1024 * 1024, '图片不能超过 20MB')
})

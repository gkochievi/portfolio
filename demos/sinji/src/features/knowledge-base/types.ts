/** Wire shapes shared by the knowledge-base screens and their mock handlers. */
import type { Id, KbDocType, KbDocument, KbStats } from '@/types'

/** A document without its (potentially long) body; the list endpoint returns these. */
export type KbDocumentRow = Omit<KbDocument, 'content_text'>

export interface KbStatsView extends KbStats {
  /** Documents per type, for the breakdown. */
  by_type: Record<KbDocType, number>
}

export interface KbDocumentPage {
  items: KbDocumentRow[]
  total: number
  page: number
  page_size: number
}

export interface KbDocumentFilters {
  status?: string
  doc_type?: string
  tag?: string
  visibility?: string
  q?: string
  page?: number
  page_size?: number
}

export interface KbDocumentPatch {
  title?: string
  doc_type?: KbDocType
  tags?: string[]
  metadata?: Record<string, string>
  content_text?: string
  visibility?: 'public' | 'internal'
}

export type KbBulkAction = 'publish' | 'unpublish' | 'reembed' | 'retag' | 'delete'

export interface KbBulkInput {
  ids: Id[]
  action: KbBulkAction
  tags?: string[]
  /** retag only: add to the existing tags or replace them. Default replace. */
  mode?: 'add' | 'replace'
}

export interface KbImportCommon {
  doc_type: KbDocType
  title?: string
  tags: string[]
  metadata: Record<string, string>
  restructure: boolean
}

export interface KbImportFilesInput extends KbImportCommon {
  files: { name: string; size: number; text?: string }[]
}

export interface KbImportTextInput extends KbImportCommon {
  text: string
}

export interface KbImportCsvInput extends KbImportCommon {
  filename: string
  rows: { question: string; answer: string }[]
}

export interface KbImportResult {
  documents: KbDocumentRow[]
  failed: { name: string; error: string }[]
}

export const KB_DOC_TYPES: KbDocType[] = ['product', 'policy', 'faq', 'procedure', 'script', 'glossary', 'other']
export const KB_FILE_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'xlsm', 'csv', 'txt', 'md'] as const
export const KB_TEXT_EXTENSIONS = ['csv', 'txt', 'md'] as const

import DOMPurify from 'isomorphic-dompurify'

type Config = {
  ALLOWED_TAGS?: string[]
  ALLOWED_ATTR?: string[]
  ALLOW_DATA_ATTR?: boolean
  FORBID_TAGS?: string[]
  FORBID_ATTR?: string[]
  ADD_ATTR?: string[]
  ADD_TAGS?: string[]
  FORCE_BODY?: boolean
  WHOLE_DOCUMENT?: boolean
  RETURN_DOM?: boolean
  RETURN_DOM_FRAGMENT?: boolean
  RETURN_DOM_IMPORT?: boolean
  SANITIZE_DOM?: boolean
  KEEP_CONTENT?: boolean
}

export const ALLOWED_TAGS: readonly string[] = [
  'a',
  'abbr',
  'acronym',
  'address',
  'b',
  'big',
  'blockquote',
  'br',
  'center',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'dfn',
  'dir',
  'div',
  'dl',
  'dt',
  'em',
  'font',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'tt',
  'u',
  'ul',
  'var',
] as const

export const ALLOWED_ATTRIBUTES: Record<string, readonly string[]> = {
  '*': ['class', 'id', 'title', 'lang', 'dir'],
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  font: ['color', 'face', 'size'],
  table: ['border', 'cellpadding', 'cellspacing', 'width'],
  td: ['colspan', 'rowspan', 'width', 'height'],
  th: ['colspan', 'rowspan', 'width', 'height'],
  col: ['span', 'width'],
  colgroup: ['span'],
  ol: ['start', 'type'],
  ul: ['type'],
  li: ['value'],
  blockquote: ['cite'],
  q: ['cite'],
  del: ['cite', 'datetime'],
  ins: ['cite', 'datetime'],
}

export interface SanitizeOptions {
  allowedTags?: string[]
  allowedAttributes?: Record<string, string[]>
  allowDataAttributes?: boolean
}

const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'applet',
  'meta',
  'link',
  'base',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'style',
  'noscript',
  'template',
]

export function sanitizeHtml(html: string, options?: SanitizeOptions): string {
  if (typeof html !== 'string') {
    return ''
  }

  if (html.length === 0) {
    return ''
  }

  const allowedTags = options?.allowedTags ?? [...ALLOWED_TAGS]
  const allowedAttributes = options?.allowedAttributes ?? convertToMutable(ALLOWED_ATTRIBUTES)

  const config: Config = {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: getAllowedAttributesFlat(allowedAttributes),
    ALLOW_DATA_ATTR: options?.allowDataAttributes ?? false,
    FORBID_TAGS: DANGEROUS_TAGS,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    ADD_ATTR: ['target'],
    ADD_TAGS: [],
    FORCE_BODY: true,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
  }

  try {
    return String(DOMPurify.sanitize(html, config))
  } catch {
    return ''
  }
}

function convertToMutable(obj: Record<string, readonly string[]>): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = [...value]
  }
  return result
}

function getAllowedAttributesFlat(allowedAttributes: Record<string, string[]>): string[] {
  const flat: Set<string> = new Set()

  for (const attrs of Object.values(allowedAttributes)) {
    for (const attr of attrs) {
      flat.add(attr.toLowerCase())
    }
  }

  return Array.from(flat)
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

const CONTROL_CHAR_PATTERN = /[\x00-\x1F\x7F]/g // eslint-disable-line no-control-regex
const HTML_ESCAPE_PATTERN = /[&<>"'`=/]/g

export function sanitizePlainText(text: string): string {
  if (typeof text !== 'string') {
    return ''
  }

  if (text.length === 0) {
    return ''
  }

  const withoutControlChars = text.replace(CONTROL_CHAR_PATTERN, '')

  return withoutControlChars.replace(HTML_ESCAPE_PATTERN, (char) => {
    return HTML_ESCAPE_MAP[char] ?? char
  })
}

const HTML_TAG_PATTERN = /<[^>]*>/g

export function stripHtml(html: string): string {
  if (typeof html !== 'string') {
    return ''
  }

  if (html.length === 0) {
    return ''
  }

  const sanitized = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  })

  return sanitized.replace(HTML_TAG_PATTERN, '').replace(/\s+/g, ' ').trim()
}

export function containsDangerousContent(html: string): boolean {
  if (typeof html !== 'string' || html.length === 0) {
    return false
  }

  const lowerHtml = html.toLowerCase()

  for (const tag of DANGEROUS_TAGS) {
    const openTagPattern = new RegExp(`<${tag}[\\s>]`, 'i')
    if (openTagPattern.test(lowerHtml)) {
      return true
    }
  }

  const eventHandlerMatches = lowerHtml.match(/\bon\w+\s*=/gi)
  if (eventHandlerMatches && eventHandlerMatches.length > 0) {
    return true
  }

  const dangerousProtocols = ['javascript:', 'vbscript:', 'data:text/html', 'data:application']
  for (const protocol of dangerousProtocols) {
    if (lowerHtml.includes(protocol)) {
      return true
    }
  }

  return false
}

export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return ''
  }

  const trimmed = url.trim()

  if (trimmed.length === 0) {
    return ''
  }

  const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:', 'ftp:']
  const lowerUrl = trimmed.toLowerCase()

  const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)

  if (hasProtocol) {
    const isSafe = safeProtocols.some((protocol) => lowerUrl.startsWith(protocol))
    if (!isSafe) {
      return ''
    }
  }

  if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('vbscript:')) {
    return ''
  }

  return trimmed
}

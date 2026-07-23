import { downloadBlobFile, exportDate } from '@/lib/download'

interface MarkdownImageOptions {
  title: string
  meta?: string
  html: string
  filename: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function exportCss() {
  const background = cssVar('--surface', '#ffffff')
  const ink = cssVar('--ink', '#111118')
  const cell = cssVar('--cell', '#2f3037')
  const muted = cssVar('--muted', '#52525e')
  const heading = cssVar('--heading', '#8b8b99')
  const faint = cssVar('--faint', '#ededf2')
  const line = cssVar('--line', '#e4e4e9')
  const surface2 = cssVar('--surface-2', '#f8f8fa')
  const surface3 = cssVar('--surface-3', '#f1f1f5')
  const blue = cssVar('--blue', '#6366f1')
  const codeBg = cssVar('--code-bg', '#f6f8fa')
  const codeText = cssVar('--code-text', '#24292f')
  const codeLine = cssVar('--code-line', '#d8dee4')
  const readingSize = cssVar('--reading-font-size', '15px')
  const readingLineHeight = cssVar('--reading-line-height', '1.86')
  const readingCodeSize = cssVar('--reading-code-font-size', '13px')
  const fontFamily = getComputedStyle(document.documentElement).fontFamily

  return `
    * { box-sizing: border-box; }
    .markdown-export-card {
      width: 760px;
      padding: 34px 38px 30px;
      color: ${cell};
      background: ${background};
      font-family: ${fontFamily};
      -webkit-font-smoothing: antialiased;
    }
    .markdown-export-meta {
      margin: 0 0 8px;
      color: ${heading};
      font-size: 13px;
      font-weight: 620;
      line-height: 1.5;
    }
    .markdown-export-title {
      margin: 0 0 22px;
      color: ${ink};
      font-size: 24px;
      font-weight: 760;
      line-height: 1.42;
    }
    .markdown-content {
      min-width: 0;
      color: ${cell};
      font-size: ${readingSize};
      line-height: ${readingLineHeight};
    }
    .markdown-content > *:first-child { margin-top: 0; }
    .markdown-content > *:last-child { margin-bottom: 0; }
    .markdown-content h1,
    .markdown-content h2,
    .markdown-content h3,
    .markdown-content h4 {
      margin: 22px 0 9px;
      color: ${ink};
      line-height: 1.38;
    }
    .markdown-content h1 { font-size: calc(${readingSize} + 4px); }
    .markdown-content h2 { font-size: calc(${readingSize} + 2px); }
    .markdown-content h3,
    .markdown-content h4 { font-size: ${readingSize}; }
    .markdown-content p,
    .markdown-content li,
    .markdown-content blockquote,
    .markdown-content table {
      font-size: ${readingSize};
    }
    .markdown-content p { margin: 0 0 13px; }
    .markdown-content ul,
    .markdown-content ol {
      margin: 0 0 15px;
      padding-left: 22px;
    }
    .markdown-content li + li { margin-top: 4px; }
    .markdown-content blockquote {
      margin: 0 0 15px;
      padding-left: 13px;
      border-left: 2px solid ${line};
      color: ${muted};
    }
    .markdown-content hr {
      margin: 20px 0;
      border: 0;
      border-top: 1px solid ${faint};
    }
    .markdown-content a {
      color: ${blue};
      text-decoration: none;
    }
    .markdown-content table {
      width: 100%;
      margin: 0 0 15px;
      border-collapse: collapse;
    }
    .markdown-content th,
    .markdown-content td {
      padding: 8px 10px;
      border: 1px solid ${faint};
    }
    .markdown-content th {
      color: ${ink};
      background: ${surface2};
      font-weight: 650;
    }
    .markdown-content code {
      padding: 2px 5px;
      border-radius: 5px;
      color: ${ink};
      background: ${surface3};
      font-size: calc(${readingCodeSize} - 0.5px);
      font-family: ui-monospace, SFMono-Regular, Consolas, Liberation Mono, monospace;
    }
    .markdown-content pre {
      overflow: hidden;
      margin: 0 0 17px;
      padding: 16px 17px;
      border-radius: 10px;
      color: ${codeText};
      background: ${codeBg};
      box-shadow: inset 0 0 0 1px ${codeLine};
    }
    .markdown-content pre code {
      padding: 0;
      color: inherit;
      background: transparent;
      font-size: ${readingCodeSize};
      line-height: 1.68;
      white-space: pre-wrap;
    }
    .markdown-export-footer {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid ${faint};
      color: ${heading};
      font-size: 12px;
      font-weight: 620;
    }
  `
}

function createExportMarkup({ title, meta, html }: MarkdownImageOptions) {
  return `
    <style>${exportCss()}</style>
    <article class="markdown-export-card">
      ${meta ? `<p class="markdown-export-meta">${escapeHtml(meta)}</p>` : ''}
      <h1 class="markdown-export-title">${escapeHtml(title)}</h1>
      <div class="markdown-content">${html}</div>
      <div class="markdown-export-footer">QFace · ${exportDate()}</div>
    </article>
  `
}

function svgDataUrl(markup: string, width: number, height: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${markup}</div>
      </foreignObject>
    </svg>
  `

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function safeExportFilename(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

export async function copyMarkdownText(content: string) {
  await navigator.clipboard.writeText(content)
}

export async function exportMarkdownImage(options: MarkdownImageOptions) {
  const markup = createExportMarkup(options)
  const measure = document.createElement('div')

  measure.style.cssText =
    'position:absolute;left:-10000px;top:0;width:760px;pointer-events:none;opacity:0;'
  measure.innerHTML = markup
  document.body.appendChild(measure)

  const card = measure.querySelector<HTMLElement>('.markdown-export-card')
  const width = 760
  const height = Math.ceil(card?.scrollHeight ?? 420)

  measure.remove()

  const image = new Image()
  const scale = Math.min(2, window.devicePixelRatio || 1)

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('图片导出失败'))
    image.src = svgDataUrl(markup, width, height)
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)

  const context = canvas.getContext('2d')
  if (!context) throw new Error('图片导出失败')

  context.scale(scale, scale)
  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png', 0.94),
  )
  if (!blob) throw new Error('图片导出失败')

  downloadBlobFile(`${options.filename}.png`, blob)
}

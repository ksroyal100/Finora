'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ============================================================
// Renders AI-generated markdown (bold, headings, tables, lists,
// code) as real styled elements instead of raw '**text**' /
// '| a | b |' showing up literally. Used anywhere an assistant
// message is displayed — currently the AI Coach chat.
// ============================================================

export default function MarkdownMessage({ content, isUser }: { content: string; isUser?: boolean }) {
  const textColor = isUser ? '#000' : 'var(--text-primary)'
  const mutedColor = isUser ? 'rgba(0,0,0,0.65)' : 'var(--text-secondary)'
  const borderColor = isUser ? 'rgba(0,0,0,0.15)' : 'var(--border)'
  const codeBg = isUser ? 'rgba(0,0,0,0.08)' : 'var(--overlay-subtle)'

  return (
    <div style={{ fontSize: 14, lineHeight: 1.65, color: textColor }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p style={{ margin: '0 0 10px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{children}</p>,
          h1: ({ children }) => <h1 style={{ fontSize: 18, fontWeight: 700, margin: '16px 0 8px', color: textColor }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: 16, fontWeight: 700, margin: '14px 0 8px', color: textColor }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 700, margin: '12px 0 6px', color: textColor }}>{children}</h3>,
          strong: ({ children }) => <strong style={{ fontWeight: 700, color: textColor }}>{children}</strong>,
          em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
          ul: ({ children }) => <ul style={{ margin: '0 0 10px', paddingLeft: 20 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: '0 0 10px', paddingLeft: 20 }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: 4, overflowWrap: 'anywhere' }}>{children}</li>,
          hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${borderColor}`, margin: '12px 0' }} />,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" style={{ color: isUser ? '#000' : 'var(--text-green)', textDecoration: 'underline' }}>
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote style={{ margin: '0 0 10px', paddingLeft: 12, borderLeft: `3px solid ${isUser ? 'rgba(0,0,0,0.25)' : 'var(--text-green)'}`, color: mutedColor }}>
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = Boolean(className) // remark marks fenced code blocks with a language className
            if (isBlock) {
              return (
                <code style={{ display: 'block', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, background: codeBg, borderRadius: 8, padding: '10px 12px', margin: '0 0 10px', overflowX: 'auto' }}>
                  {children}
                </code>
              )
            }
            return (
              <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, background: codeBg, borderRadius: 4, padding: '1px 5px' }}>
                {children}
              </code>
            )
          },
          pre: ({ children }) => <pre style={{ margin: '0 0 10px', overflowX: 'auto' }}>{children}</pre>,
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '0 0 10px' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          th: ({ children }) => (
            <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: `2px solid ${borderColor}`, fontWeight: 700, color: textColor, whiteSpace: 'nowrap' }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ padding: '6px 10px', borderBottom: `1px solid ${borderColor}` }}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

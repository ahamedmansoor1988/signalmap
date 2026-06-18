import { diffLines, type Change } from 'diff'

export interface DiffResult {
  addedLines: string[]
  removedLines: string[]
  diffHtml: string
  hasChanges: boolean
  changePercent: number
}

export function computeDiff(before: string, after: string): DiffResult {
  const changes: Change[] = diffLines(before, after, { ignoreWhitespace: true })

  const addedLines: string[] = []
  const removedLines: string[] = []
  const htmlParts: string[] = []

  let totalLines = 0
  let changedLines = 0

  for (const change of changes) {
    const lines = change.value.split('\n').filter(Boolean)
    totalLines += lines.length

    if (change.added) {
      addedLines.push(...lines)
      changedLines += lines.length
      htmlParts.push(
        lines
          .map((l) => `<ins class="diff-add">${escapeHtml(l)}</ins>`)
          .join('\n')
      )
    } else if (change.removed) {
      removedLines.push(...lines)
      changedLines += lines.length
      htmlParts.push(
        lines
          .map((l) => `<del class="diff-remove">${escapeHtml(l)}</del>`)
          .join('\n')
      )
    } else {
      // Show up to 2 context lines around changes
      const contextLines = lines.slice(0, 2)
      if (contextLines.length) {
        htmlParts.push(
          contextLines
            .map((l) => `<span class="diff-context">${escapeHtml(l)}</span>`)
            .join('\n')
        )
      }
    }
  }

  return {
    addedLines,
    removedLines,
    diffHtml: htmlParts.join('\n'),
    hasChanges: addedLines.length > 0 || removedLines.length > 0,
    changePercent: totalLines > 0 ? Math.round((changedLines / totalLines) * 100) : 0,
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

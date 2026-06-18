// Text diff utilities — Sprint 2
// Computes diffs between page snapshots

export interface DiffResult {
  addedLines: string[]
  removedLines: string[]
  diffHtml: string
}

export function computeDiff(_before: string, _after: string): DiffResult {
  throw new Error('Diff engine not yet implemented — coming in Sprint 2')
}

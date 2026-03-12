import * as vscode from 'vscode'
import { levenshtein } from '../utils/levenshtein'
import { getKnownMacros } from '../macros'

type BestMatchProps = {
  name: string
  dist: number
}

const NAME_REGEX = /\{\{\s*([A-Za-z0-9_\-]+)(?:\s*\(|\s*\}\})?/
const KNOWN_MACROS = getKnownMacros(vscode.env.language || 'en')

const findAllDiagnostics = (diags: readonly vscode.Diagnostic[]): vscode.Diagnostic[] => {
  return diags.filter(
    (d) => d.source === 'mdn-macros' && d.code === 'unknownMacro'
  )
}

const matchWithMacro = (document: vscode.TextDocument, diagnostic: vscode.Diagnostic): {
  nameIdx?: number,
  unknownName?: string
} | undefined => {
  const text = document.getText(diagnostic.range)
  const unknownName = NAME_REGEX.exec(text)?.[1]
  const nameIdx = text.indexOf(unknownName || '')
  return { nameIdx, unknownName }
}

const getBestMatch = (unknownName: string): BestMatchProps | null => {
  let best: BestMatchProps | null = null
  for (const k of Object.keys(KNOWN_MACROS)) {
    const d = levenshtein(unknownName.toLowerCase(), k.toLowerCase())
    if (!best || d < best.dist) best = { name: k, dist: d }
  }
  return best
}

const codeActionProvider: vscode.CodeActionProvider = {
  provideCodeActions(document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext) {
    const actions: vscode.CodeAction[] = []
    const diagnostics = findAllDiagnostics(context.diagnostics)

    if (diagnostics.length > 1) {
      let allMatchs = []
      for (const diagnostic of diagnostics) {
        const { nameIdx, unknownName } = matchWithMacro(document, diagnostic) || {}
        if (nameIdx === undefined || !unknownName) continue

        let bestMatch = getBestMatch(unknownName)
        if (bestMatch && bestMatch.dist <= Math.max(1, Math.floor(unknownName.length / 3))) {
          allMatchs.push({ diagnostic, nameIdx, unknownName, bestMatch })
        }
      }
      const action = new vscode.CodeAction(`Replace ${allMatchs.length} macros`, vscode.CodeActionKind.QuickFix)
      const we = new vscode.WorkspaceEdit()
      for (const { diagnostic, nameIdx, unknownName, bestMatch } of allMatchs) {
        const startOffset = document.offsetAt(diagnostic.range.start) + nameIdx
        const editRange = new vscode.Range(
          document.positionAt(startOffset),
          document.positionAt(startOffset + unknownName.length)
        )
        we.replace(document.uri, editRange, bestMatch.name)
        action.diagnostics = [...(action.diagnostics || []), diagnostic]
      }
      action.edit = we
      action.isPreferred = true
      actions.push(action)
    } else if (diagnostics.length === 1) {
      const diagnostic = diagnostics[0]
      const { nameIdx, unknownName } = matchWithMacro(document, diagnostic) || {}
      if (nameIdx === undefined || !unknownName) return actions

      let bestMatch = getBestMatch(unknownName)
      if (bestMatch && bestMatch.dist <= Math.max(1, Math.floor(unknownName.length / 3))) {
        const action = new vscode.CodeAction(`Replace with '${bestMatch.name}'`, vscode.CodeActionKind.QuickFix)
        if (nameIdx >= 0) {
          const startOffset = document.offsetAt(diagnostic.range.start) + nameIdx
          const editRange = new vscode.Range(
            document.positionAt(startOffset),
            document.positionAt(startOffset + unknownName.length)
          )
          const we = new vscode.WorkspaceEdit()
          we.replace(document.uri, editRange, bestMatch.name)
          action.diagnostics = [diagnostic]
          action.edit = we
          action.isPreferred = true
          actions.push(action)
        }
      }
    }

    // 0, 1 or more results
    return actions
  }
}

export { codeActionProvider }

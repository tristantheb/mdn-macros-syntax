import * as vscode from 'vscode'
import { getMacroText } from '../utils/constants'

/**
 * Semantic tokens legend for MDN macros.
 */
export const legend = new vscode.SemanticTokensLegend(['function', 'string', 'number', 'keyword', 'parameter'], [])

const tokenTypeIndex = (type: string): number => {
  const map: { [k: string]: number } = { function: 0, string: 1, number: 2, keyword: 3, parameter: 4 }
  return map[type] ?? 0
}

const parseArgsWithPositions = (argsRaw: string, absStart: number): Array<{
  text: string;
  start: number;
  end: number
}> => {
  const res: Array<{ text: string; start: number; end: number }> = []
  let inSingle = false, inDouble = false
  let argStart = 0
  for (let i = 0; i < argsRaw.length; i++) {
    const ch = argsRaw[i]
    if (ch === '\'' && !inDouble) { inSingle = !inSingle }
    else if (ch === '"' && !inSingle) { inDouble = !inDouble }
    else if (ch === ',' && !inSingle && !inDouble) {
      const raw = argsRaw.slice(argStart, i)
      res.push({ text: raw, start: absStart + argStart, end: absStart + i })
      argStart = i + 1
    }
  }
  // last
  if (argsRaw.length > 0) {
    const rawLast = argsRaw.slice(argStart)
    res.push({ text: rawLast, start: absStart + argStart, end: absStart + argsRaw.length })
  }
  return res
}

/**
 * Semantic tokens provider — mark macro names and argument tokens
 * (strings/numbers/booleans).
 */
const provider: vscode.DocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
    const builder = new vscode.SemanticTokensBuilder(legend)
    const text = document.getText()
    let match: RegExpExecArray | null
    while ((match = getMacroText(text)) !== null) {
      const fullStart = match.index
      const fullText = match[0]
      const name = match[1]
      const argsRaw = match[2] || ''

      const nameIndexInFull = fullText.indexOf(name)
      const nameAbsStart = fullStart + nameIndexInFull
      const namePos = document.positionAt(nameAbsStart)
      builder.push(namePos.line, namePos.character, name.length, tokenTypeIndex('function'), 0)

      if (argsRaw.length === 0) continue

      const parenIndex = fullText.indexOf('(')
      const argsAbsStart = fullStart + parenIndex + 1
      const args = parseArgsWithPositions(argsRaw, argsAbsStart)
      for (const a of args) {
        const raw = a.text.trim()
        if (raw.length === 0) continue
        const startPos = document.positionAt(a.start + a.text.indexOf(raw))
        const length = raw.length
        let ttype = 'parameter'
        const lower = raw.toLowerCase()
        if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith('\'') && raw.endsWith('\''))) {
          ttype = 'string'
        } else if (/^\d+(?:\.\d+)?$/.test(raw)) {
          ttype = 'number'
        } else if (lower === 'true' || lower === 'false') {
          ttype = 'keyword'
        }
        builder.push(startPos.line, startPos.character, length, tokenTypeIndex(ttype), 0)
      }
    }
    return builder.build()
  }
}

export { provider }

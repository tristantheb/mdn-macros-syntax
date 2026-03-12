import * as vscode from 'vscode'
import { getKnownMacros } from '../../macros'
import { ENVIRONMENT_LOCALE, MACRO_REGEX } from '../../utils/constants'
import { levenshtein } from '../../utils/levenshtein'

class MacroDiagnosticComponent {
  private cachedKnownMacros: Record<string, unknown> | null = null
  private cachedKnownMacroNamesLower: string[] | null = null

  public activate(context: vscode.ExtensionContext, collection: vscode.DiagnosticCollection) {
    const refresh = (document: vscode.TextDocument) => {
      try {
        const diags = this.getDiagnostics(document)
        collection.set(document.uri, diags)
      } catch (err) {
        // swallow; ActivationManager logs
        console.error('MacroDiagnosticComponent: error computing diagnostics', err)
      }
    }

    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(refresh))
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => refresh(e.document)))
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri)))

    // initial pass
    if (vscode.workspace.textDocuments) {
      vscode.workspace.textDocuments.forEach(refresh)
    }
  }

  private isRelevant(document: vscode.TextDocument): boolean {
    return document.languageId === 'markdown'
  }

  private findSuggestion(name: string, known: Record<string, unknown>): string {
    // prepare lowercase known names cache for faster levenshtein checks
    if (!this.cachedKnownMacroNamesLower) {
      this.cachedKnownMacroNamesLower = Object.keys(known).map(k => k.toLowerCase())
    }

    let best: { name: string; dist: number } | null = null
    for (const kLower of this.cachedKnownMacroNamesLower) {
      const d = levenshtein(name.toLowerCase(), kLower)
      if (!best || d < best.dist) best = { name: kLower, dist: d }
    }
    const threshold = Math.max(1, Math.floor(name.length / 3))
    return best && best.dist <= threshold ? `Did you mean '${best.name}'?` : ''
  }

  private buildDiagnostic(document: vscode.TextDocument, range: vscode.Range, name: string, suggestion: string) {
    const message = `Unknown MDN macro: ${name}`
    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning)
    diagnostic.source = 'mdn-macros'
    diagnostic.code = 'unknownMacro'
    if (suggestion) {
      diagnostic.relatedInformation = [
        new vscode.DiagnosticRelatedInformation(new vscode.Location(document.uri, range), suggestion)
      ]
    }
    return diagnostic
  }
  private makeDiagnosticForMatch(
    match: RegExpMatchArray,
    document: vscode.TextDocument,
    known: Record<string, unknown>
  ): vscode.Diagnostic | null {
    const name = match[1]
    if (known[name]) return null

    const start = document.positionAt(match.index ?? 0)
    const end = document.positionAt((match.index ?? 0) + match[0].length)
    const range = new vscode.Range(start, end)

    const suggestion = this.findSuggestion(name, known)
    return this.buildDiagnostic(document, range, name, suggestion)
  }

  public getDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
    if (!this.isRelevant(document)) return []

    const text = document.getText()
    if (!this.cachedKnownMacros) this.cachedKnownMacros = getKnownMacros(ENVIRONMENT_LOCALE)
    const KNOWN_MACROS = this.cachedKnownMacros

    const diagnostics: vscode.Diagnostic[] = []
    for (const match of text.matchAll(MACRO_REGEX)) {
      const diag = this.makeDiagnosticForMatch(match as RegExpMatchArray, document, KNOWN_MACROS)
      if (diag) diagnostics.push(diag)
    }

    return diagnostics
  }
}

export { MacroDiagnosticComponent }

import * as vscode from 'vscode'
import { activateAllDecorations } from './components/BlockDecorations'
import { activateAllDiagnostics } from './components/Diagnostics'
import { activateAllHovers } from './components/Hovers'
import { activateAllMarkers } from './components/Markers'
import { registerHooks } from './hooks/activation'
import { codeActionProvider } from './providers/codeActionProvider'
import { completionProvider } from './providers/completionProvider'
import { provider as semanticProvider, legend as semanticLegend } from './providers/semanticTokensProvider'
import { DOCUMENT_SELECTOR } from './utils/constants'
import { initOutput, appendLine, LogLevel } from './utils/output'
import { isMdnRepo } from './utils/repoDetection'

class ActivationManager {
  private context: vscode.ExtensionContext
  private featuresActivated = false
  private diagnosticCollection?: vscode.DiagnosticCollection

  constructor(context: vscode.ExtensionContext, diagnosticCollection?: vscode.DiagnosticCollection) {
    this.context = context
    this.diagnosticCollection = diagnosticCollection
    initOutput(this.context)
  }

  /** Public entry to enable features (idempotent). Lazy-loads providers. */
  public async initFeatures(): Promise<void> {
    if (this.featuresActivated) return
    this.featuresActivated = true

    appendLine(LogLevel.INFO, '[init] enabling features')

    await this.registerProviders()
    await this.registerComponents()
    try {
      registerHooks(this.context)
    } catch (err) {
      appendLine(LogLevel.ERROR, '[init] failed to register hooks: ' + String(err))
    }
  }

  private async registerProviders(): Promise<void> {
    // lightweight decorators/hovers/markers are already plain imports
    try {
      this.context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
          DOCUMENT_SELECTOR,
          completionProvider,
          '{'
        )
      )

      this.context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
          DOCUMENT_SELECTOR,
          codeActionProvider,
          { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        )
      )

      this.context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
          DOCUMENT_SELECTOR,
          semanticProvider,
          semanticLegend
        )
      )
    } catch (err) {
      appendLine(LogLevel.ERROR, '[init] failed to register providers: ' + String(err))
      console.error(err)
    }
  }

  private async registerComponents(): Promise<void> {
    try {
      activateAllHovers(this.context)
      activateAllDecorations(this.context)
      activateAllMarkers(this.context)
      activateAllDiagnostics(this.context, this.diagnosticCollection!)
    } catch (err) {
      appendLine(LogLevel.ERROR, '[init] failed to register providers: ' + String(err))
      console.error(err)
    }
  }

  /** Run detection and (if positive) initialize features */
  public async detectAndInit(): Promise<void> {
    try {
      const detected = await isMdnRepo()
      if (detected) {
        appendLine(LogLevel.INFO, '[loader] MDN repo detected — initializing features')
        await this.initFeatures()
      } else {
        appendLine(LogLevel.INFO, '[loader] MDN repo not detected — features remain disabled')
      }
    } catch (err) {
      console.error('[loader] error during repo detection', err)
    }
  }

  /** Watch workspace-folder changes and re-run detection if still disabled */
  public setupWatcher(): void {
    const watcher = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      if (this.featuresActivated) return
      await this.detectAndInit()
    })
    this.context.subscriptions.push(watcher)
  }
}

export default ActivationManager

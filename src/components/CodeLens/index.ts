import * as vscode from 'vscode'
import { CodeLensProvider } from './CodeLensProvider'
import { DOCUMENT_SELECTOR } from '../../utils/constants'

type RefreshableProvider = vscode.CodeLensProvider & { refresh?: () => void }

const CODELENS_PROVIDERS: RefreshableProvider[] = [
  new CodeLensProvider()
]

let compositeDisposable: vscode.Disposable | undefined

const createCompositeProvider = (): { provider: vscode.CodeLensProvider; emitter: vscode.EventEmitter<void> } => {
  const emitter = new vscode.EventEmitter<void>()

  const normalizeProviderResult = async (r: vscode.ProviderResult<vscode.CodeLens[]>) : Promise<vscode.CodeLens[]> => {
    if (!r)
      return []
    const resolved = await r
    if (!resolved || !Array.isArray(resolved))
      return []
    return resolved.filter((c): c is vscode.CodeLens => Boolean(c))
  }

  const provide = (document: vscode.TextDocument, token: vscode.CancellationToken) =>
    Promise.all(CODELENS_PROVIDERS.map(p => normalizeProviderResult(p.provideCodeLenses(document, token))))
      .then((arr) => arr.flat())

  return { provider: { onDidChangeCodeLenses: emitter.event, provideCodeLenses: provide }, emitter }
}

const registerComposite = (context: vscode.ExtensionContext, provider: vscode.CodeLensProvider) => {
  compositeDisposable = vscode.languages.registerCodeLensProvider(
    DOCUMENT_SELECTOR,
    provider
  )
  context.subscriptions.push(compositeDisposable)
}

const registerChildEvents = (context: vscode.ExtensionContext, emitter: vscode.EventEmitter<void>) => {
  for (const p of CODELENS_PROVIDERS) {
    if (p.onDidChangeCodeLenses) context.subscriptions.push(p.onDidChangeCodeLenses(() => emitter.fire()))
  }
}

const registerRefreshListeners = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => CODELENS_PROVIDERS.forEach(p => p.refresh?.()))
  )
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document)
        CODELENS_PROVIDERS.forEach(p => p.refresh?.())
    })
  )
}

const activateAllCodeLens = (context: vscode.ExtensionContext) => {
  const { provider, emitter } = createCompositeProvider()
  registerComposite(context, provider)
  registerChildEvents(context, emitter)
  registerRefreshListeners(context)
}

const deactivateAllCodeLens = () => compositeDisposable?.dispose()

export { activateAllCodeLens, deactivateAllCodeLens }

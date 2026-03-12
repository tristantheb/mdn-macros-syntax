import { window, workspace, type ExtensionContext, type TextEditor, TextEditorDecorationType } from 'vscode'
import { CodeBlockDecorationsComponent } from './CodeBlockDecorationsComponent'
import { FrontMatterDecorationsComponent } from './FrontMatterDecorationsComponent'

// List of all block decorators (add more as needed)
const BLOCK_DECORATORS = [
  new CodeBlockDecorationsComponent(),
  new FrontMatterDecorationsComponent()
]

const activateAllDecorations = (context: ExtensionContext) => {
  let decoratorInstances = BLOCK_DECORATORS.map(
    decorator => ({
      decorations: decorator.getDecorations(context),
      findRanges: decorator.findRanges.bind(decorator)
    })
  )

  // To dispose old decorations on theme change
  let allDecorationTypes: TextEditorDecorationType[] = []

  const disposeAllDecorations = () => {
    for (const deco of allDecorationTypes) deco.dispose()
    allDecorationTypes = []
  }

  const updateAllDecorations = (editor: TextEditor | undefined) => {
    if (!editor) return
    const doc = editor.document
    if (doc.languageId !== 'markdown') return

    for (const decorator of decoratorInstances) {
      const ranges = decorator.findRanges(doc)
      const decorations = decorator.decorations
      for (const k of Object.keys(decorations)) {
        editor.setDecorations(decorations[k], (ranges && ranges[k]) ? ranges[k] : [])
      }
    }
  }

  // Listeners to update decorations
  context.subscriptions.push(window.onDidChangeActiveTextEditor((e) => updateAllDecorations(e)))
  context.subscriptions.push(workspace.onDidChangeTextDocument((e) => {
    if (window.activeTextEditor && e.document === window.activeTextEditor.document) {
      updateAllDecorations(window.activeTextEditor)
    }
  }))

  // Rebuild decorations when theme changes
  context.subscriptions.push(window.onDidChangeActiveColorTheme(() => {
    disposeAllDecorations()
    decoratorInstances = BLOCK_DECORATORS.map(decorator => ({
      instance: decorator,
      decorations: decorator.getDecorations(context),
      findRanges: decorator.findRanges
    }))
    // Collect all decoration types for disposal next time
    allDecorationTypes = decoratorInstances.flatMap(d => Object.values(d.decorations))
    updateAllDecorations(window.activeTextEditor)
  }))

  // Collect all decoration types for disposal
  allDecorationTypes = decoratorInstances.flatMap(d => Object.values(d.decorations))

  // Initial run
  updateAllDecorations(window.activeTextEditor)
}

export { activateAllDecorations }

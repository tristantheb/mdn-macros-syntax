import * as vscode from 'vscode'
import { getKnownMacros } from '../../macros'
import { ENVIRONMENT_LOCALE } from '../../utils/constants'
import { parseMacroAtOffset } from '../../utils/parse'
import type { MacroDefinition } from '../../types/macro'

export class MacroHoverComponent {
  getHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    const offset = document.offsetAt(position)
    const found = parseMacroAtOffset(document.getText(), offset)
    if (!found) return undefined
    const KNOWN_MACROS = getKnownMacros(ENVIRONMENT_LOCALE)
    const info: MacroDefinition | undefined = KNOWN_MACROS[found.name]
    if (!info) return undefined
    const mdText = this.buildMarkdown(found, info)
    const md = new vscode.MarkdownString(mdText)
    md.isTrusted = true
    return new vscode.Hover(md)
  }

  private buildMarkdown(found: { name: string; args: string[] }, info: MacroDefinition): string {
    const enInfo = this.getEnglishFallback(found.name, info)
    const params = this.buildParamsSignature(info)
    const paramLines = this.buildParamLines(info, enInfo)
    const args = found.args.length ? `\n\nArguments: ${found.args.join(', ')}` : ''
    const descriptionText = info.description || (enInfo && enInfo.description) || ''

    let mdText = `**${found.name}** ${params}\n\n${descriptionText}${args}`
    if (paramLines.length) {
      const bullets = paramLines.map(l => `- ${l}`).join('\n')
      mdText += `\n\nParameter descriptions:\n\n${bullets}`
    }

    const deprecation = info.deprecated
    if (deprecation) mdText += this.buildDeprecationSection(deprecation)
    return mdText
  }

  private getEnglishFallback(name: string, info: MacroDefinition): MacroDefinition | undefined {
    if (info.description && !(info.params && info.params.some(p => !p.description))) return undefined
    try {
      const enKnown = getKnownMacros('en')
      return enKnown[name]
    } catch {
      return undefined
    }
  }

  private buildParamsSignature(info: MacroDefinition): string {
    return info.params ? `(${info.params.map((p) => p.name).join(', ')})` : ''
  }

  private buildParamLines(
    info: MacroDefinition,
    enInfo?: MacroDefinition
  ): string[] {
    const paramLines: string[] = []
    if (!info.params) return paramLines
    for (let i = 0; i < info.params.length; i++) {
      const p = info.params[i]
      const allowed = p.allowedValues ? ` Allowed values: ${p.allowedValues.join(', ')}` : ''
      const descFromInfo: string = p.description || ''
      const descFromEnByName: string | undefined = enInfo && enInfo.params
        ? enInfo.params.find((ep) => ep.name === p.name)?.description
        : undefined
      const descFromEnByPos: string | undefined = enInfo && enInfo.params && enInfo.params[i]
        ? enInfo.params[i].description
        : undefined
      const descText = descFromInfo || descFromEnByName || descFromEnByPos || ''
      const typeText = p.type || ''
      const optionalText = p.optional ? ' (optional)' : ''
      paramLines.push(`${p.name}${optionalText}: ${typeText} — ${descText}${allowed}`)
    }
    return paramLines
  }

  private buildDeprecationSection(deprecation: string | true) {
    const deprecationText = typeof deprecation === 'string'
      ? deprecation
      : 'This macro is deprecated and should be removed from documentation.'
    return `\n\n---\n\n**DEPRECATED:** ${deprecationText}`
  }
}

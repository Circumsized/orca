import { removeAgentArgOption } from './agent-session-option-agent-args'
import type {
  AgentSessionOptionCatalog,
  CatalogModel,
  CatalogOption
} from './agent-session-option-catalog-types'
import { parseOmpModelList } from './omp-model-list-probe'

// The widest effort menu a model with no listing row may still accept: OMP clamps a tier a
// model lacks to the closest one it supports, so launch may offer more than a model runs.
// `off`, `auto` and `inherit` are modes rather than tiers and stay out of it.
const OMP_EFFORT_CHOICES = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Max' }
]

/** One reasoning-effort option. `levels` builds a listed model's own menu; without levels it
 *  builds the launch-safe fallback. A listed menu starts on its lowest tier, like a
 *  discovered model's menu; the fallback starts on `high`, OMP's own default tier. */
function ompEffort(levels?: readonly { id: string; label: string }[]): CatalogOption {
  const listed = levels && levels.length > 0 ? levels : null
  return {
    id: 'effort',
    label: 'Reasoning effort',
    category: 'thought_level',
    kind: {
      type: 'select',
      choices: listed
        ? listed.map(({ id, label }) => ({ value: id, label }))
        : [...OMP_EFFORT_CHOICES],
      defaultValue: listed ? listed[0]!.id : 'high'
    },
    apply: {
      launchArgs: (value) => ['--thinking', String(value)],
      removeAgentArgs: (tokens) => removeAgentArgOption('omp', tokens, ['--thinking']),
      // OMP applies a level to the running session through its own `/effort` command.
      midSession: { kind: 'command', build: (value) => `/effort ${String(value)}` }
    }
  }
}

/** Catalog rows for `omp models --json` output: a listed model carries its own effort
 *  menu from its thinking ladder; a row without a ladder carries none.
 *  The enrichment gate reads only `listModels`' presence; the probe itself parses
 *  through `agent-model-probe-spec.ts`, so keep this private to that gate. */
function parseOmpCatalogModels(stdout: string): CatalogModel[] {
  return parseOmpModelList(stdout).map((model) => ({
    ...model,
    options: model.thinkingLevels?.length ? [ompEffort(model.thinkingLevels)] : []
  }))
}

export const OMP_SESSION_OPTION_CATALOG: AgentSessionOptionCatalog = {
  supportsWorkerLaunchPreferences: true,
  // Why: OMP's selectable models are whatever providers the user configured keys
  // for — no id is available on every install, and `/model` rejects an unknown
  // one. Seed nothing: desktop fills the picker from discovery, and every surface
  // keeps the row the hook reports as the session's current model.
  models: [],
  modelApply: {
    launchArgs: (value) => ['--model', String(value)],
    removeAgentArgs: (tokens) => removeAgentArgOption('omp', tokens, ['--model']),
    // OMP only opens its TUI picker for /model; our extension applies the exact selector.
    midSession: { kind: 'command', build: (value) => `/orca-model ${String(value)}` }
  },
  // Launch-safe for a model no listing carries; a listed model's own ladder rules its menu.
  unknownModelOptions: [ompEffort()],
  // Why: with no seed there is nothing to keep; a persisted id the host no longer
  // lists is a fatal `--model` at launch, so discovery must be able to retire it.
  discoveredModelsAreAuthoritative: true,
  listModels: { command: 'omp models --json', parse: parseOmpCatalogModels }
}

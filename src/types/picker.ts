export interface Entry {
  id: string
  name: string
  removed: boolean
}

export interface Draw {
  id: string
  entryId: string
  name: string
  timestamp: string
}

export interface CommittedCatch {
  draw: Draw
  candidates: readonly Entry[]
}

export type ThemePreference = 'system' | 'light' | 'dark'

export interface PickerState {
  version: 1
  entries: Entry[]
  removeCaught: boolean
  history: Draw[]
  theme: ThemePreference
}

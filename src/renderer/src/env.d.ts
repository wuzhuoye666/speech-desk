import type { SpeechDeskApi } from '../../shared/types'

declare global {
  interface Window { speechDesk: SpeechDeskApi }
}

export {}

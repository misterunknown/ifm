// i18n: the PHP backend stays the source of truth (api=getI18N merges the
// configured language over English). The bundled en.json is only the boot
// fallback so the login screen can render before the first round-trip.
import { ref } from 'vue'
import enFallbackJson from '../../src/i18n/en.json'
import { apiPost } from './api'

const enFallback: Record<string, string> = enFallbackJson

const dict = ref<Record<string, string>>({ ...enFallback })

export function t(key: string): string {
  return dict.value[key] ?? enFallback[key] ?? key
}

export async function loadI18n(): Promise<void> {
  const remote = await apiPost<Record<string, string>>('getI18N', {})
  dict.value = { ...enFallback, ...remote }
}

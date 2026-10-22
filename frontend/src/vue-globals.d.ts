// Global component declarations for template type-checking.
import type { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

declare module 'vue' {
  interface GlobalComponents {
    FaIcon: typeof FontAwesomeIcon
  }
}

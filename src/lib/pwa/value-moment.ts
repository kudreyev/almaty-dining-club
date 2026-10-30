/** Момент ценности: гость получил код или код погашен — только после него предлагаем установку и push. */
export const VALUE_MOMENT_EVENT = 'kc:value-moment'

export type ValueMomentKind = 'code_shown' | 'code_redeemed'

export function emitValueMoment(kind: ValueMomentKind) {
  try {
    window.dispatchEvent(new CustomEvent(VALUE_MOMENT_EVENT, { detail: { kind } }))
  } catch {
    // ignore
  }
}

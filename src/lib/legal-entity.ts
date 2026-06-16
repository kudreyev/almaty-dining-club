export type LegalEntity = {
  /** Полное название, напр. ИП «FOODX» или ТОО «Kilogram Media» */
  name: string
  /** 12-значный БИН (ТОО) или ИИН (ИП) */
  bin: string
  /** Юридический адрес */
  legalAddress: string
  /** Email для претензий (если требует процессинг) */
  email?: string
}

/**
 * Реквизиты юрлица для подвала сайта (требование платёжного процессинга).
 */
export const LEGAL_ENTITY: LegalEntity = {
  name: 'ИП «FOODX»',
  bin: '',
  legalAddress: 'г. Алматы, ул. Кармысова, 84/2, к1',
}

function taxIdLabel(name: string): 'БИН' | 'ИИН' {
  return name.trim().startsWith('ИП') ? 'ИИН' : 'БИН'
}

export function formatLegalEntityFooterLines(entity: LegalEntity): string[] {
  const lines: string[] = []

  if (entity.name.trim()) {
    lines.push(entity.name.trim())
  }

  if (entity.bin.trim()) {
    lines.push(`${taxIdLabel(entity.name)} ${entity.bin.trim()}`)
  }

  if (entity.legalAddress.trim()) {
    lines.push(entity.legalAddress.trim())
  }

  if (entity.email?.trim()) {
    lines.push(entity.email.trim())
  }

  return lines
}

export function hasLegalEntityDetails(entity: LegalEntity): boolean {
  return Boolean(entity.name.trim() && entity.legalAddress.trim())
}

export type TrackerEntry = {
  id: string
  at: string
  weightLb: number
  heightFt: number
  heightIn: number
  bmi: number
}

const STORAGE_KEY = 'wttracker-entries'

export function heightInches(heightFt: number, heightIn: number): number {
  return heightFt * 12 + heightIn
}

/** Imperial BMI: 703 × weight_lb / height_in² */
export function computeBmi(weightLb: number, heightFt: number, heightIn: number): number {
  const inches = heightInches(heightFt, heightIn)
  if (inches <= 0 || !Number.isFinite(inches)) return NaN
  return (703 * weightLb) / (inches * inches)
}

function newId(): string {
  return crypto.randomUUID()
}

function parseStoredEntry(v: unknown): { entry: TrackerEntry; needsPersist: boolean } | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (
    typeof o.at !== 'string' ||
    typeof o.weightLb !== 'number' ||
    typeof o.heightFt !== 'number' ||
    typeof o.heightIn !== 'number' ||
    typeof o.bmi !== 'number'
  ) {
    return null
  }
  const id =
    typeof o.id === 'string' && o.id.length > 0 ? o.id : newId()
  const needsPersist = !(typeof o.id === 'string' && o.id.length > 0)
  return {
    entry: { id, at: o.at, weightLb: o.weightLb, heightFt: o.heightFt, heightIn: o.heightIn, bmi: o.bmi },
    needsPersist,
  }
}

export function loadEntries(): TrackerEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const entries: TrackerEntry[] = []
    let needsSave = false
    for (const item of parsed) {
      const parsedEntry = parseStoredEntry(item)
      if (!parsedEntry) continue
      if (parsedEntry.needsPersist) needsSave = true
      entries.push(parsedEntry.entry)
    }
    if (needsSave) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    }
    return entries
  } catch {
    return []
  }
}

export function saveEntries(entries: TrackerEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function createEntry(partial: Omit<TrackerEntry, 'id'>): TrackerEntry {
  return { ...partial, id: newId() }
}

export function sortEntriesByDate(entries: TrackerEntry[]): TrackerEntry[] {
  return [...entries].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  )
}

/** Newest first — for history dropdown */
export function sortEntriesByDateDesc(entries: TrackerEntry[]): TrackerEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )
}

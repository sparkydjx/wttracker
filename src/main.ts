import './style.css'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Filler,
} from 'chart.js'
import { registerSW } from 'virtual:pwa-register'
import {
  computeBmi,
  createEntry,
  loadEntries,
  saveEntries,
  sortEntriesByDate,
  sortEntriesByDateDesc,
  type TrackerEntry,
} from './trackerData.ts'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Filler,
)

const today = new Date()

function formatDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${month}/${day}/${year}`
}

type WeightGoal = {
  targetWeightLb: number
  targetDateIso: string
}

const GOAL_STORAGE_KEY = 'wttracker-goal'
const SHOW_GOAL_ON_CHARTS_STORAGE_KEY = 'wttracker-show-goal-on-charts'
const DEV_PHONE_MOCK_STORAGE_KEY = 'wttracker-dev-phone-mock'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<section class="tracker">
  <header class="tracker-header">
    <h1>Weight Tracker</h1>
    <p class="tracker-sub">Log weight, height, and date</p>
  </header>

  <form class="entry-form" id="entry-form">
    <p class="form-error" id="form-error" role="alert" hidden></p>
    <div class="field">
      <label for="weight">Weight</label>
      <div class="field-input">
        <input
          type="number"
          id="weight"
          name="weight"
          min="0"
          step="0.1"
          inputmode="decimal"
          placeholder="0"
          required
        />
        <span class="suffix" aria-hidden="true">lbs</span>
      </div>
    </div>

    <fieldset class="field">
      <legend>Height</legend>
      <div class="height-row">
        <div class="field-input tight">
          <label class="sr-only" for="height-ft">Feet</label>
          <input
            type="number"
            id="height-ft"
            name="heightFt"
            min="0"
            max="8"
            step="1"
            inputmode="numeric"
            placeholder="0"
            required
          />
          <span class="suffix" aria-hidden="true">ft</span>
        </div>
        <div class="field-input tight">
          <label class="sr-only" for="height-in">Inches</label>
          <input
            type="number"
            id="height-in"
            name="heightIn"
            min="0"
            max="11"
            step="1"
            inputmode="numeric"
            placeholder="0"
            required
          />
          <span class="suffix" aria-hidden="true">in</span>
        </div>
      </div>
    </fieldset>

    <fieldset class="field">
      <legend>Date</legend>
      <div class="date-row">
        <div class="field-input">
          <label class="sr-only" for="date-input">Date (MM/DD/YYYY)</label>
          <input
            type="text"
            id="date-input"
            name="dateInput"
            inputmode="numeric"
            placeholder="MM/DD/YYYY"
            value="${formatDateInputValue(today)}"
            required
          />
          <span class="suffix muted" aria-hidden="true">MM/DD/YYYY</span>
        </div>
      </div>
    </fieldset>

    <div class="form-actions">
      <button type="submit" class="btn-primary" id="save-entry">Save entry</button>
    </div>
  </form>

  <div class="history-panel history-panel-below" id="history-panel" hidden>
    <label for="history-select" class="history-label">Edit a past entry</label>
    <select id="history-select" class="history-select" aria-label="Select a past entry to load for editing">
      <option value="">— Select a date —</option>
    </select>
    <button type="button" class="btn-danger" id="delete-entry" hidden>Delete entry</button>
    <p class="edit-banner" id="edit-banner" hidden>
      Editing <strong id="edit-banner-date"></strong>
      <button type="button" class="btn-link" id="cancel-edit">Cancel</button>
    </p>
  </div>

  <section class="goal-panel">
    <div class="goal-panel-header">
      <h2 class="goal-heading">Goal</h2>
    </div>
    <p class="goal-current" id="goal-current">No goal set yet.</p>
    <label class="goal-chart-toggle" for="show-goal-on-charts">
      <input type="checkbox" id="show-goal-on-charts" />
      Show goal on charts
    </label>
    <form class="goal-form" id="goal-form">
      <div class="field">
        <label for="goal-weight">Target weight</label>
        <div class="field-input">
          <input
            type="number"
            id="goal-weight"
            name="goalWeight"
            min="0"
            step="0.1"
            inputmode="decimal"
            placeholder="0"
            required
          />
          <span class="suffix" aria-hidden="true">lbs</span>
        </div>
      </div>
      <div class="field">
        <label for="goal-date">Target date</label>
        <div class="field-input">
          <input
            type="text"
            id="goal-date"
            name="goalDate"
            inputmode="numeric"
            placeholder="MM/DD/YYYY"
            required
          />
          <span class="suffix muted" aria-hidden="true">MM/DD/YYYY</span>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary">SET GOAL</button>
      </div>
    </form>
  </section>

  <div class="charts-panel" id="charts-panel" hidden>
    <h2 class="charts-heading">Weight over time</h2>
    <p class="trend-summary" id="weight-trend-summary"></p>
    <div class="chart-wrap">
      <canvas id="chart-weight" aria-label="Weight over time"></canvas>
    </div>
    <h2 class="charts-heading">BMI over time</h2>
    <div class="chart-wrap">
      <canvas id="chart-bmi" aria-label="BMI over time"></canvas>
    </div>
  </div>
</section>
`

const form = document.getElementById('entry-form') as HTMLFormElement
const errEl = document.getElementById('form-error') as HTMLParagraphElement
const chartsPanel = document.getElementById('charts-panel') as HTMLDivElement
const historyPanel = document.getElementById('history-panel') as HTMLDivElement
const historySelect = document.getElementById('history-select') as HTMLSelectElement
const editBanner = document.getElementById('edit-banner') as HTMLParagraphElement
const editBannerDate = document.getElementById('edit-banner-date') as HTMLElement
const cancelEditBtn = document.getElementById('cancel-edit') as HTMLButtonElement
const saveBtn = document.getElementById('save-entry') as HTMLButtonElement
const deleteBtn = document.getElementById('delete-entry') as HTMLButtonElement
const goalForm = document.getElementById('goal-form') as HTMLFormElement
const goalCurrent = document.getElementById('goal-current') as HTMLParagraphElement
const goalWeightInput = document.getElementById('goal-weight') as HTMLInputElement
const goalDateInput = document.getElementById('goal-date') as HTMLInputElement
const showGoalOnChartsInput = document.getElementById('show-goal-on-charts') as HTMLInputElement
const weightTrendSummary = document.getElementById('weight-trend-summary') as HTMLParagraphElement

const weightInput = document.getElementById('weight') as HTMLInputElement
const heightFtInput = document.getElementById('height-ft') as HTMLInputElement
const heightInInput = document.getElementById('height-in') as HTMLInputElement
const dateInput = document.getElementById('date-input') as HTMLInputElement

let weightChart: Chart | null = null
let bmiChart: Chart | null = null
let editingEntryId: string | null = null

function shouldEnablePhoneMockInDev(): boolean {
  if (!import.meta.env.DEV) return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('mockPhone') === '1') return true
  if (params.get('mockPhone') === '0') return false
  try {
    return localStorage.getItem(DEV_PHONE_MOCK_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function setPhoneMockEnabled(enabled: boolean): void {
  document.body.classList.toggle('phone-mock-enabled', enabled)
}

function savePhoneMockPreference(enabled: boolean): void {
  try {
    localStorage.setItem(DEV_PHONE_MOCK_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // Ignore storage write failures in private browsing modes.
  }
}

function setupDevPhoneMockToggle(): void {
  if (!import.meta.env.DEV) return
  let isEnabled = shouldEnablePhoneMockInDev()
  setPhoneMockEnabled(isEnabled)

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'dev-phone-toggle'
  button.textContent = isEnabled ? 'Disable phone mock' : 'Enable phone mock'
  button.setAttribute('aria-pressed', isEnabled ? 'true' : 'false')
  button.addEventListener('click', () => {
    isEnabled = !isEnabled
    setPhoneMockEnabled(isEnabled)
    savePhoneMockPreference(isEnabled)
    button.textContent = isEnabled ? 'Disable phone mock' : 'Enable phone mock'
    button.setAttribute('aria-pressed', isEnabled ? 'true' : 'false')
  })
  document.body.appendChild(button)
}

function parseStoredGoal(v: unknown): WeightGoal | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.targetDateIso !== 'string' || typeof o.targetWeightLb !== 'number') return null
  if (!Number.isFinite(o.targetWeightLb) || o.targetWeightLb <= 0) return null
  return {
    targetDateIso: o.targetDateIso,
    targetWeightLb: o.targetWeightLb,
  }
}

function loadGoal(): WeightGoal | null {
  try {
    const raw = localStorage.getItem(GOAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return parseStoredGoal(parsed)
  } catch {
    return null
  }
}

function saveGoal(goal: WeightGoal): void {
  localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goal))
}

function loadShowGoalOnChartsPref(): boolean {
  try {
    return localStorage.getItem(SHOW_GOAL_ON_CHARTS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function saveShowGoalOnChartsPref(enabled: boolean): void {
  localStorage.setItem(SHOW_GOAL_ON_CHARTS_STORAGE_KEY, enabled ? '1' : '0')
}

function chartTheme() {
  const root = getComputedStyle(document.documentElement)
  return {
    text: (root.getPropertyValue('--text-h').trim() || '#08060d').replaceAll('"', ''),
    muted: (root.getPropertyValue('--text').trim() || '#6b6375').replaceAll('"', ''),
    border: (root.getPropertyValue('--border').trim() || '#e5e4e7').replaceAll('"', ''),
    line: (root.getPropertyValue('--chart-line').trim() || '#9ca3af').replaceAll('"', ''),
    accent: (root.getPropertyValue('--accent').trim() || '#aa3bff').replaceAll('"', ''),
    accentBg: root.getPropertyValue('--accent-bg').trim() || 'rgba(170, 59, 255, 0.1)',
    tooltipBg:
      root.getPropertyValue('--chart-tooltip-bg').trim() ||
      root.getPropertyValue('--surface').trim() ||
      '#fff',
    tooltipBorder:
      root.getPropertyValue('--chart-tooltip-border').trim() ||
      root.getPropertyValue('--border').trim() ||
      '#e5e4e7',
  }
}

function destroyCharts() {
  weightChart?.destroy()
  bmiChart?.destroy()
  weightChart = bmiChart = null
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function renderGoalSummary(goal: WeightGoal | null) {
  if (!goal) {
    goalCurrent.textContent = 'No goal set yet.'
    return
  }
  goalCurrent.textContent = `Goal: ${goal.targetWeightLb} lbs by ${formatDateLabel(goal.targetDateIso)}`
}

function dayDiff(fromIso: string, toIso: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / msPerDay
}

function computeWeightSlopeLbsPerDay(entries: TrackerEntry[]): number | null {
  if (entries.length < 2) return null
  const sorted = sortEntriesByDate(entries)
  const startIso = sorted[0].at
  const points = sorted
    .map((entry) => ({
      x: dayDiff(startIso, entry.at),
      y: entry.weightLb,
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  if (points.length < 2) return null
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length
  let numerator = 0
  let denominator = 0
  for (const point of points) {
    const xDelta = point.x - meanX
    numerator += xDelta * (point.y - meanY)
    denominator += xDelta * xDelta
  }
  if (denominator === 0) return null
  return numerator / denominator
}

function renderWeightTrendSummary(entries: TrackerEntry[], goal: WeightGoal | null): void {
  const slope = computeWeightSlopeLbsPerDay(entries)
  if (slope === null) {
    weightTrendSummary.textContent = 'Add at least 2 weigh-ins to estimate your trend.'
    return
  }
  const slopeDisplay = `${slope >= 0 ? '+' : ''}${slope.toFixed(2)} lbs/day`
  const weeklyDisplay = `${Math.abs(slope * 7).toFixed(2)} lbs/week`
  const sorted = sortEntriesByDate(entries)
  const currentWeight = sorted[sorted.length - 1]?.weightLb
  if (goal === null || currentWeight === undefined) {
    weightTrendSummary.textContent = `Trend slope: ${slopeDisplay} (${weeklyDisplay}). Set a goal to estimate days to target.`
    return
  }
  const deltaToGoal = goal.targetWeightLb - currentWeight
  if (deltaToGoal === 0) {
    weightTrendSummary.textContent = `Trend slope: ${slopeDisplay} (${weeklyDisplay}). You are already at your goal weight.`
    return
  }
  if (slope === 0 || Math.sign(deltaToGoal) !== Math.sign(slope)) {
    weightTrendSummary.textContent = `Trend slope: ${slopeDisplay} (${weeklyDisplay}). Current trend does not move toward your goal.`
    return
  }
  const estimatedDays = Math.ceil(Math.abs(deltaToGoal / slope))
  weightTrendSummary.textContent = `Trend slope: ${slopeDisplay} (${weeklyDisplay}). Estimated ${estimatedDays} day${estimatedDays === 1 ? '' : 's'} to reach ${goal.targetWeightLb} lbs.`
}

function renderCharts(entries: TrackerEntry[], goal: WeightGoal | null, showGoalOnCharts: boolean) {
  destroyCharts()
  const sorted = sortEntriesByDate(entries)
  if (sorted.length === 0) {
    chartsPanel.hidden = true
    weightTrendSummary.textContent = ''
    return
  }

  chartsPanel.hidden = false
  renderWeightTrendSummary(sorted, goal)
  const labelsIso = sorted.map((e) => e.at)
  const latestEntry = sorted[sorted.length - 1]
  const shouldShowGoalLine = showGoalOnCharts && goal !== null
  const allLabelIso = shouldShowGoalLine
    ? [...labelsIso, goal.targetDateIso].sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime(),
      )
    : labelsIso
  const uniqueLabelIso: string[] = []
  for (const iso of allLabelIso) {
    if (uniqueLabelIso[uniqueLabelIso.length - 1] !== iso) {
      uniqueLabelIso.push(iso)
    }
  }
  const labels = uniqueLabelIso.map((iso) => formatDateLabel(iso))
  const indexByIso = new Map<string, number>()
  uniqueLabelIso.forEach((iso, index) => indexByIso.set(iso, index))
  const weights: Array<number | null> = Array.from({ length: uniqueLabelIso.length }, () => null)
  const bmis: Array<number | null> = Array.from({ length: uniqueLabelIso.length }, () => null)
  for (const entry of sorted) {
    const index = indexByIso.get(entry.at)
    if (index === undefined) continue
    weights[index] = entry.weightLb
    bmis[index] = Math.round(entry.bmi * 10) / 10
  }
  const goalWeights: Array<number | null> = Array.from({ length: uniqueLabelIso.length }, () => null)
  const goalBmis: Array<number | null> = Array.from({ length: uniqueLabelIso.length }, () => null)
  if (shouldShowGoalLine && goal) {
    const latestIndex = indexByIso.get(latestEntry.at)
    const goalIndex = indexByIso.get(goal.targetDateIso)
    const goalBmi = Math.round(computeBmi(goal.targetWeightLb, latestEntry.heightFt, latestEntry.heightIn) * 10) / 10
    if (latestIndex !== undefined && goalIndex !== undefined && Number.isFinite(goalBmi)) {
      goalWeights[latestIndex] = latestEntry.weightLb
      goalWeights[goalIndex] = goal.targetWeightLb
      goalBmis[latestIndex] = Math.round(latestEntry.bmi * 10) / 10
      goalBmis[goalIndex] = goalBmi
    }
  }
  const theme = chartTheme()

  function bmiPointColor(value: number): string {
    if (value >= 40) return '#ef4444'
    if (value >= 30) return '#f97316'
    if (value >= 25) return '#eab308'
    if (value >= 19) return '#22c55e'
    return '#3b82f6'
  }

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    events: [],
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { color: theme.border },
        ticks: { color: theme.muted, maxRotation: 45, minRotation: 0 },
      },
      y: {
        grid: { color: theme.border },
        ticks: { color: theme.muted },
      },
    },
  }

  const wCanvas = document.getElementById('chart-weight') as HTMLCanvasElement
  const bCanvas = document.getElementById('chart-bmi') as HTMLCanvasElement

  weightChart = new Chart(wCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Weight (lbs)',
          data: weights,
          borderColor: theme.line,
          backgroundColor: theme.accentBg,
          pointBackgroundColor: theme.line,
          pointBorderColor: theme.line,
          fill: true,
          tension: 0.25,
          pointRadius: 4.4,
          pointHoverRadius: 6.6,
        },
        ...(shouldShowGoalLine
          ? [
              {
                label: 'Goal path',
                data: goalWeights,
                borderColor: '#22c55e',
                backgroundColor: 'transparent',
                pointBackgroundColor: '#22c55e',
                pointBorderColor: '#22c55e',
                fill: false,
                borderDash: [6, 4],
                tension: 0,
                pointRadius: 4.4,
                pointHoverRadius: 6.6,
                spanGaps: true,
              },
            ]
          : []),
      ],
    },
    options: {
      ...commonOptions,
      scales: {
        ...commonOptions.scales,
        y: {
          ...commonOptions.scales.y,
          title: {
            display: true,
            text: 'lbs',
            color: theme.muted,
          },
        },
      },
    },
  })

  const bmiPointColors = bmis.map((bmi) => (typeof bmi === 'number' ? bmiPointColor(bmi) : theme.accent))

  bmiChart = new Chart(bCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'BMI',
          data: bmis,
          borderColor: theme.line,
          backgroundColor: theme.accentBg,
          fill: true,
          tension: 0.25,
          pointRadius: 4.4,
          pointHoverRadius: 6.6,
          pointBackgroundColor: bmiPointColors,
          pointBorderColor: bmiPointColors,
        },
        ...(shouldShowGoalLine
          ? [
              {
                label: 'Goal path',
                data: goalBmis,
                borderColor: '#22c55e',
                backgroundColor: 'transparent',
                pointBackgroundColor: '#22c55e',
                pointBorderColor: '#22c55e',
                fill: false,
                borderDash: [6, 4],
                tension: 0,
                pointRadius: 4.4,
                pointHoverRadius: 6.6,
                spanGaps: true,
              },
            ]
          : []),
      ],
    },
    options: {
      ...commonOptions,
      scales: {
        ...commonOptions.scales,
        y: {
          ...commonOptions.scales.y,
          title: {
            display: true,
            text: 'BMI',
            color: theme.muted,
          },
        },
      },
    },
  })
}

function refreshCharts() {
  renderCharts(loadEntries(), loadGoal(), showGoalOnChartsInput.checked)
}

function updateGoalToggleAvailability(goal: WeightGoal | null) {
  showGoalOnChartsInput.disabled = goal === null
  if (!goal) {
    showGoalOnChartsInput.checked = false
    return
  }
  showGoalOnChartsInput.checked = loadShowGoalOnChartsPref()
}

function parseDateParts(y: number, m: number, d: number): Date | null {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return dt
}

function parseDateInputValue(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  return parseDateParts(year, month, day)
}

function showError(message: string) {
  errEl.textContent = message
  errEl.hidden = false
}

function clearError() {
  errEl.textContent = ''
  errEl.hidden = true
}

function setDefaultDateToday() {
  dateInput.value = formatDateInputValue(new Date())
}

function updateSaveButtonLabel() {
  saveBtn.textContent = editingEntryId ? 'Save changes' : 'Save entry'
  deleteBtn.hidden = editingEntryId === null
}

function applyEntryToForm(entry: TrackerEntry) {
  const d = new Date(entry.at)
  weightInput.value = String(entry.weightLb)
  heightFtInput.value = String(entry.heightFt)
  heightInInput.value = String(entry.heightIn)
  dateInput.value = formatDateInputValue(d)
}

function refreshHistorySelect() {
  const entries = sortEntriesByDateDesc(loadEntries())
  const selected = editingEntryId
  historySelect.innerHTML = ''
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = '— Select a date —'
  historySelect.appendChild(placeholder)
  for (const e of entries) {
    const opt = document.createElement('option')
    opt.value = e.id
    opt.textContent = `${formatDateLabel(e.at)} · ${e.weightLb} lbs`
    historySelect.appendChild(opt)
  }
  if (selected && entries.some((e) => e.id === selected)) {
    historySelect.value = selected
  }
}

function updateHistoryPanelVisibility() {
  historyPanel.hidden = loadEntries().length === 0
}

function prefillFromLastEntry(entries: TrackerEntry[]) {
  if (entries.length === 0) return
  const latest = entries.reduce((a, b) =>
    new Date(a.at).getTime() >= new Date(b.at).getTime() ? a : b,
  )
  heightFtInput.value = String(latest.heightFt)
  heightInInput.value = String(latest.heightIn)
}

function resetFormForNewEntry() {
  const entries = loadEntries()
  setDefaultDateToday()
  prefillFromLastEntry(entries)
  weightInput.value = ''
}

function cancelEdit() {
  editingEntryId = null
  editBanner.hidden = true
  historySelect.value = ''
  updateSaveButtonLabel()
  clearError()
  resetFormForNewEntry()
}

historySelect.addEventListener('change', () => {
  const id = historySelect.value
  if (!id) {
    if (editingEntryId !== null) {
      cancelEdit()
    }
    return
  }
  const entry = loadEntries().find((e) => e.id === id)
  if (!entry) {
    showError('That entry is no longer available.')
    historySelect.value = ''
    return
  }
  editingEntryId = id
  applyEntryToForm(entry)
  editBannerDate.textContent = formatDateLabel(entry.at)
  editBanner.hidden = false
  updateSaveButtonLabel()
  clearError()
})

cancelEditBtn.addEventListener('click', () => {
  cancelEdit()
})

deleteBtn.addEventListener('click', () => {
  if (!editingEntryId) return
  const entries = loadEntries()
  const entry = entries.find((e) => e.id === editingEntryId)
  if (!entry) {
    showError('Could not find that entry. Pick it from the list again.')
    editingEntryId = null
    updateSaveButtonLabel()
    refreshHistorySelect()
    return
  }

  const confirmed = window.confirm(
    `Delete the entry for ${formatDateLabel(entry.at)} (${entry.weightLb} lbs)?`,
  )
  if (!confirmed) return

  const next = entries.filter((e) => e.id !== editingEntryId)
  saveEntries(next)
  refreshCharts()
  updateHistoryPanelVisibility()
  refreshHistorySelect()
  cancelEdit()
})

form.addEventListener('submit', (e) => {
  e.preventDefault()
  clearError()

  const weightLb = Number(weightInput.value)
  const heightFt = Number(heightFtInput.value)
  const heightIn = Number(heightInInput.value)

  if (weightLb <= 0 || !Number.isFinite(weightLb)) {
    showError('Enter a positive weight in pounds.')
    return
  }
  if (
    !Number.isFinite(heightFt) ||
    heightFt < 0 ||
    !Number.isFinite(heightIn) ||
    heightIn < 0 ||
    heightIn > 11
  ) {
    showError('Height must be valid feet and inches (0–11 for inches).')
    return
  }
  const totalIn = heightFt * 12 + heightIn
  if (totalIn <= 0) {
    showError('Height must be greater than zero.')
    return
  }

  const date = parseDateInputValue(dateInput.value)
  if (!date) {
    showError('Enter a valid date in MM/DD/YYYY format.')
    return
  }

  const bmi = computeBmi(weightLb, heightFt, heightIn)
  if (!Number.isFinite(bmi)) {
    showError('Could not compute BMI from the values entered.')
    return
  }

  const atNoonLocal = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
    0,
  )

  const bmiRounded = Math.round(bmi * 10) / 10
  const atIso = atNoonLocal.toISOString()

  if (editingEntryId) {
    const entries = loadEntries()
    const ix = entries.findIndex((x) => x.id === editingEntryId)
    if (ix === -1) {
      showError('Could not find that entry. Pick it from the list again.')
      editingEntryId = null
      updateSaveButtonLabel()
      refreshHistorySelect()
      return
    }
    entries[ix] = {
      ...entries[ix],
      at: atIso,
      weightLb,
      heightFt,
      heightIn,
      bmi: bmiRounded,
    }
    saveEntries(entries)
    refreshCharts()
    updateHistoryPanelVisibility()
    refreshHistorySelect()
    cancelEdit()
    return
  }

  const entry = createEntry({
    at: atIso,
    weightLb,
    heightFt,
    heightIn,
    bmi: bmiRounded,
  })

  const next = [...loadEntries(), entry]
  saveEntries(next)
  refreshCharts()
  updateHistoryPanelVisibility()
  refreshHistorySelect()
  prefillFromLastEntry(next)

  weightInput.value = ''
  weightInput.focus()
})

function init() {
  setupDevPhoneMockToggle()
  const entries = loadEntries()
  updateHistoryPanelVisibility()
  refreshHistorySelect()
  prefillFromLastEntry(entries)
  refreshCharts()
  const goal = loadGoal()
  renderGoalSummary(goal)
  showGoalOnChartsInput.checked = loadShowGoalOnChartsPref()
  updateGoalToggleAvailability(goal)
  if (goal) {
    goalWeightInput.value = String(goal.targetWeightLb)
    goalDateInput.value = formatDateInputValue(new Date(goal.targetDateIso))
  } else {
    goalDateInput.value = formatDateInputValue(today)
  }
}

init()

goalForm.addEventListener('submit', (e) => {
  e.preventDefault()
  clearError()

  const targetWeightLb = Number(goalWeightInput.value)
  if (!Number.isFinite(targetWeightLb) || targetWeightLb <= 0) {
    showError('Enter a positive target weight in pounds.')
    return
  }

  const targetDate = parseDateInputValue(goalDateInput.value)
  if (!targetDate) {
    showError('Enter a valid target date in MM/DD/YYYY format.')
    return
  }

  const targetAtNoonLocal = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    12,
    0,
    0,
    0,
  )

  const goal: WeightGoal = {
    targetWeightLb: Math.round(targetWeightLb * 10) / 10,
    targetDateIso: targetAtNoonLocal.toISOString(),
  }
  saveGoal(goal)
  renderGoalSummary(goal)
  updateGoalToggleAvailability(goal)
  refreshCharts()
})

showGoalOnChartsInput.addEventListener('change', () => {
  saveShowGoalOnChartsPref(showGoalOnChartsInput.checked)
  refreshCharts()
})

registerSW({ immediate: true })

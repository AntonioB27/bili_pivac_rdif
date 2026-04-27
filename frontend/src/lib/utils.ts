import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('hr-HR', {
    timeZone: 'Europe/Zagreb',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hr-HR', {
    timeZone: 'Europe/Zagreb',
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function toMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getLast12Months(): string[] {
  const months: string[] = []
  const d = new Date()
  for (let i = 0; i < 12; i++) {
    months.push(toMonthString(new Date(d.getFullYear(), d.getMonth() - i, 1)))
  }
  return months
}

const MONTHS_HR = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac',
]

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  return `${MONTHS_HR[parseInt(m) - 1]} ${year}`
}

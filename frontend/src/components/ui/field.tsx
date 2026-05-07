interface FieldProps {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}

export function Field({ label, hint, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label htmlFor={htmlFor} className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</label>
        {hint && <span className="font-mono text-[10px] text-muted-foreground/50">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

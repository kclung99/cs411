import { cn } from '@/lib/utils'

function DerivedLabel({ label, tooltip, className }) {
  return (
    <span className={cn('group relative inline-flex items-center gap-1', className)}>
      <span>{label}</span>
      <button
        type="button"
        aria-label={`${label} is derived. ${tooltip}`}
        className="cursor-help rounded-sm text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        *
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-72 rounded-md border bg-background p-2 text-xs font-normal text-foreground shadow-md group-hover:block group-focus-within:block"
      >
        {tooltip}
      </span>
    </span>
  )
}

function DerivedLegend({ className }) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      * indicates a derived/computed value, not a directly stored base column.
    </p>
  )
}

export { DerivedLabel, DerivedLegend }

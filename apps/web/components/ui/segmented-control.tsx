'use client'

import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  className?: string
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'

  return (
    <div
      className={cn(
        'inline-flex rounded-lg border-2 border-border bg-muted/80 p-1 gap-1 shadow-sm',
        className
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              pad,
              'rounded-md font-medium transition-all duration-150 whitespace-nowrap',
              selected
                ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/50 font-semibold scale-[1.03] z-[1]'
                : 'text-muted-foreground/80 bg-transparent hover:text-foreground hover:bg-background/60 opacity-75 hover:opacity-100'
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

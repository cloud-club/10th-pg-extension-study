import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11.5px] font-medium leading-tight',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-muted-foreground',
        bigm: 'border-bigm/30 bg-bigm/15 text-bigm',
        trgm: 'border-trgm/30 bg-trgm/15 text-trgm',
        tsv: 'border-tsv/30 bg-tsv/15 text-tsv',
        ok: 'border-ok/30 bg-ok/15 text-ok',
        warn: 'border-warn/30 bg-warn/15 text-warn',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { badgeVariants }

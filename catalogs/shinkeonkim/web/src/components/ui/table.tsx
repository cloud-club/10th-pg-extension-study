import * as React from 'react'
import { cn } from '@/lib/utils'

/** 표는 항상 자기 컨테이너 안에서 가로 스크롤한다 — 페이지가 옆으로 밀리면 안 된다. */
export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table ref={ref} className={cn('w-full caption-bottom border-collapse text-[13.5px]', className)} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

export const THead = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('bg-secondary/50', className)} {...props} />
)
export const TBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn(className)} {...props} />
)
export const TR = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-b border-border last:border-0 hover:bg-secondary/25', className)} {...props} />
)
export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground', className)} {...props} />
)
export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-2 align-middle', className)} {...props} />
)
export const TCaption = ({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) => (
  <caption className={cn('mt-2 text-left text-[12px] text-muted-foreground', className)} {...props} />
)

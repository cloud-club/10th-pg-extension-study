import type { ChartData, ChartOptions, ChartType } from 'chart.js'
import { Chart as ReactChart } from 'react-chartjs-2'
import '@/lib/chart'
import { cn } from '@/lib/utils'

type Props<T extends ChartType> = {
  type: T
  data: ChartData<T>
  options?: ChartOptions<T>
  /** 차트 아래에 붙는 한 줄 해설. 그림만 두고 "알아서 읽어라" 하지 않는다. */
  caption?: React.ReactNode
  title?: React.ReactNode
  height?: number
  className?: string
}

export function ChartBox<T extends ChartType>({
  type, data, options, caption, title, height = 300, className,
}: Props<T>) {
  return (
    <figure className={cn('rounded-xl border border-border bg-card p-4', className)}>
      {title && <figcaption className="mb-3 text-[14px] font-semibold">{title}</figcaption>}
      <div style={{ height }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ReactChart type={type} data={data as any} options={options as any} />
      </div>
      {caption && <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{caption}</p>}
    </figure>
  )
}

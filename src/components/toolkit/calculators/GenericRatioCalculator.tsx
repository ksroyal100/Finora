'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

export interface RatioField {
  key: string
  label: string
  defaultValue: number
  prefix?: string
  suffix?: string
  step?: number
  max?: number
  showSlider?: boolean
  hint?: string
}

export interface RatioResultStat {
  key: string
  label: string
  format: (v: number) => string
  color?: string
  size?: 'md' | 'lg'
}

export interface RatioCalculatorConfig {
  slug: string
  title: string
  categoryLabel: string
  description: string
  fields: RatioField[]
  compute: (values: Record<string, number>) => Record<string, number>
  resultStats: RatioResultStat[]
  insights: (values: Record<string, number>, result: Record<string, number>) => string[]
}

export function GenericRatioCalculator({ config }: { config: RatioCalculatorConfig }) {
  const defaults = useMemo(() => {
    const d: Record<string, number> = {}
    config.fields.forEach(f => { d[f.key] = f.defaultValue })
    return d
  }, [config.fields])

  const [values, setValues] = useState<Record<string, number>>(defaults)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<Record<string, number>, Record<string, number>>(config.slug)
  const result = useMemo(() => config.compute(values), [values, config])
  const insights = useMemo(() => config.insights(values, result), [values, result, config])

  const update = (key: string, v: number) => setValues(prev => ({ ...prev, [key]: v }))

  return (
    <ToolShell
      title={config.title}
      categoryLabel={config.categoryLabel}
      description={config.description}
      scenarios={scenarios}
      onSave={name => save(name, values, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setValues(s.input)}
      inputsPanel={
        <>
          {config.fields.map(f => (
            <NumberField
              key={f.key}
              label={f.label}
              value={values[f.key]}
              onChange={v => update(f.key, v)}
              prefix={f.prefix}
              suffix={f.suffix}
              step={f.step ?? 1}
              max={f.max}
              showSlider={f.showSlider}
              hint={f.hint}
            />
          ))}
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {config.resultStats.map(rs => (
                <ResultStat key={rs.key} label={rs.label} value={rs.format(result[rs.key] ?? 0)} color={rs.color} size={rs.size ?? 'md'} />
              ))}
            </div>
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}

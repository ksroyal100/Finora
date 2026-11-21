'use client'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number
  showSlider?: boolean
  hint?: string
}

export function NumberField({
  label, value, onChange, prefix, suffix, min = 0, max, step = 1, showSlider = false, hint,
}: NumberFieldProps) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{hint}</span>}
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && (
          <span style={{ position: 'absolute', left: 14, fontSize: 15, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
            {prefix}
          </span>
        )}
        <input
          className="input-field"
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : 0}
          onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
          style={{ paddingLeft: prefix ? 26 : 14, paddingRight: suffix ? 34 : 14, fontVariantNumeric: 'tabular-nums' }}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 14, fontSize: 13, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
            {suffix}
          </span>
        )}
      </div>
      {showSlider && max !== undefined && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ width: '100%', marginTop: 10, accentColor: 'var(--green-400)', cursor: 'pointer' }}
        />
      )}
    </div>
  )
}

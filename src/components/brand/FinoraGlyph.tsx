// The Finora "F" mark, drawn as a single stroked path so it stays crisp at any size.
// Used inside the green logo tile (sidebar, auth screens, landing page, admin).
export function FinoraGlyph({ size = 16, color = '#000' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {/* stem + top arm, with a small upward "growth" lift on the arm's end */}
      <path d="M7.5 20.5V4.5h9.2l2.3 2.4" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* middle arm */}
      <path d="M7.5 12.4h7.4" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

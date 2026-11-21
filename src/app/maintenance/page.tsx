import { createAdminClient } from '@/lib/supabase/server'

export const revalidate = 0

async function getMaintenanceMessage(): Promise<string> {
  try {
    const db = createAdminClient()
    const { data } = await db.from('system_config').select('value').eq('key', 'maintenance_mode').single()
    return (data?.value as { message?: string } | undefined)?.message
      || "Finora is temporarily down for scheduled maintenance. We'll be back shortly."
  } catch {
    return "Finora is temporarily down for scheduled maintenance. We'll be back shortly."
  }
}

export default async function MaintenancePage() {
  const message = await getMaintenanceMessage()

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ color: '#2FD968', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 20 }}>Finora</div>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>We'll be right back</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{message}</p>
      </div>
    </div>
  )
}

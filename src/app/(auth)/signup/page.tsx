import { Suspense } from 'react'
import SignUpForm from './SignUpForm'

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--green-400)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  )
}

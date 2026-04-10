import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-bold tracking-tight">Sign in to Pulse</h1>
      <p className="mb-8 text-center text-sm text-muted-foreground">
        Enter your email and password to continue
      </p>
      <LoginForm />
    </>
  )
}

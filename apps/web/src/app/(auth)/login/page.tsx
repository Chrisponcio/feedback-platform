import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'Sign in' }

interface LoginPageProps {
  searchParams: Promise<{ error?: string; redirectTo?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-bold tracking-tight">Sign in to Pulse</h1>
      <p className="mb-8 text-center text-sm text-muted-foreground">
        Enter your email and password to continue
      </p>
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {decodeURIComponent(error)}
        </div>
      )}
      <LoginForm />
    </>
  )
}

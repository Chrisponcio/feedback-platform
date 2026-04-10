import type { Metadata } from 'next'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = { title: 'Create account' }

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mb-8 text-center text-sm text-muted-foreground">
        Start collecting feedback in minutes
      </p>
      <SignupForm />
    </>
  )
}

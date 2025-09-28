'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function StepGuard({ allow, redirectTo, children }: { allow: boolean; redirectTo: string; children: React.ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    if (!allow) router.replace(redirectTo)
  }, [allow, redirectTo, router])
  if (!allow) return null
  return <>{children}</>
}

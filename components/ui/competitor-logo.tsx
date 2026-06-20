'use client'

import Image from 'next/image'
import { useState } from 'react'
import { getLogoUrl } from '@/lib/get-logo-url'

const SIZE_PX = { sm: 20, md: 28, lg: 36 } as const

// Deterministic color per initial so the same competitor always gets the same avatar
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#3b82f6',
]
function avatarBg(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
}

interface Props {
  website: string | null | undefined
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function CompetitorLogo({ website, name, size = 'md', className = '' }: Props) {
  const [failed, setFailed] = useState(false)

  const px = SIZE_PX[size]
  const logoUrl = getLogoUrl(website)
  const initial = (name?.[0] ?? '?').toUpperCase()

  const base = `rounded-lg shrink-0 overflow-hidden flex items-center justify-center ${className}`
  const dim = { width: px, height: px, minWidth: px, minHeight: px }

  if (!logoUrl || failed) {
    return (
      <div className={base} style={{ ...dim, backgroundColor: avatarBg(name ?? '') }}>
        <span style={{ fontSize: Math.round(px * 0.45), fontWeight: 700, color: '#fff', lineHeight: 1 }}>
          {initial}
        </span>
      </div>
    )
  }

  return (
    <div className={`${base} bg-white border border-gray-100`} style={dim}>
      <Image
        src={logoUrl}
        alt={name}
        width={px}
        height={px}
        unoptimized
        onError={() => setFailed(true)}
        className="object-contain w-full h-full p-[2px]"
      />
    </div>
  )
}

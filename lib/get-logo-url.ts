export function getLogoUrl(website: string | null | undefined): string | null {
  if (!website) return null
  try {
    const href = website.startsWith('http') ? website : `https://${website}`
    const domain = new URL(href).hostname.replace(/^www\./, '')
    if (!domain) return null
    return `https://logo.clearbit.com/${domain}`
  } catch {
    return null
  }
}

export function getLogoUrl(website: string | null | undefined): string | null {
  if (!website) return null
  try {
    const href = website.startsWith('http') ? website : `https://${website}`
    const domain = new URL(href).hostname.replace(/^www\./, '')
    if (!domain) return null
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch {
    return null
  }
}

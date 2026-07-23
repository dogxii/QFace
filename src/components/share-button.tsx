import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    if (navigator.share) {
      await navigator.share({ title, url: window.location.href }).catch(() => undefined)
      return
    }
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      className="quiet-action"
      type="button"
      onClick={share}
      aria-label={copied ? '已复制链接' : '分享'}
      title={copied ? '已复制链接' : '分享'}
    >
      {copied ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
      {copied ? '已复制' : '分享'}
    </button>
  )
}

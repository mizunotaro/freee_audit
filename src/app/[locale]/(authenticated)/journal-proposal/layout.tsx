import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '仕訳提案 | 管理部門支援システム',
  description: 'AIによる領収書からの仕訳自動生成',
}

export default function JournalProposalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Journal Proposal | freee_audit',
  description: 'Auto-generate journal entries from receipts using AI',
}

export default function JournalProposalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

import { PersonaLegend } from './components/persona-indicator'

export default function ChatLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      {children}
      <footer className="border-t bg-background px-6 py-3">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <PersonaLegend />
          <p className="text-xs text-muted-foreground">
            AIによる分析結果です。重要な意思決定には専門家にご相談ください。
          </p>
        </div>
      </footer>
    </div>
  )
}

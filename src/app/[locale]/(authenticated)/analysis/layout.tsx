export default function AnalysisLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl">{children}</main>
      <footer className="mt-8 border-t py-4">
        <div className="container mx-auto max-w-7xl px-6">
          <p className="text-center text-xs text-muted-foreground">
            ※ AIによる分析結果です。重要な意思決定には専門家にご相談ください。
          </p>
        </div>
      </footer>
    </div>
  )
}

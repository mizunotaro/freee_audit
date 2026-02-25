export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">freee_audit</h1>
      <p className="mb-8 text-gray-600">会計freee仕訳監査・レポートシステム</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <a
          href={`/${locale}/audit/journals`}
          className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md"
        >
          <h2 className="mb-2 text-xl font-semibold">仕訳監査</h2>
          <p className="text-sm text-gray-500">仕訳データの監査とAI分析を実行</p>
        </a>

        <a
          href={`/${locale}/audit/results`}
          className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md"
        >
          <h2 className="mb-2 text-xl font-semibold">監査結果</h2>
          <p className="text-sm text-gray-500">監査結果の一覧と詳細を確認</p>
        </a>

        <a
          href={`/${locale}/settings/freee`}
          className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md"
        >
          <h2 className="mb-2 text-xl font-semibold">設定</h2>
          <p className="text-sm text-gray-500">freee連携とAI APIの設定</p>
        </a>
      </div>

      <div className="mt-12 rounded-lg bg-gray-100 p-6">
        <h2 className="mb-4 text-lg font-semibold">クイックスタート</h2>
        <ol className="list-inside list-decimal space-y-2 text-gray-600">
          <li>
            <a href={`/${locale}/settings/freee`} className="text-blue-600 hover:underline">
              設定ページ
            </a>
            でfreeeとの連携を設定
          </li>
          <li>
            <a href={`/${locale}/settings/ai`} className="text-blue-600 hover:underline">
              AI API設定
            </a>
            でOpenAI/Gemini/Claudeを選択してAPIキーを設定
          </li>
          <li>
            <a href={`/${locale}/audit/journals`} className="text-blue-600 hover:underline">
              仕訳監査
            </a>
            でデータを同期して監査を実行
          </li>
        </ol>
      </div>
    </div>
  )
}

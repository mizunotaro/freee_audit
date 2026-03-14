import { NextIntlClientProvider } from 'next-intl'
import { Toaster } from '@/components/ui/sonner'
import '../globals.css'
import { Locale, locales, defaultLocale } from '@/lib/i18n/types'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale: paramLocale } = await params
  const locale: Locale = locales.includes(paramLocale as Locale)
    ? (paramLocale as Locale)
    : defaultLocale

  const messages = (await import(`../../../messages/${locale}.json`)).default

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background">
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

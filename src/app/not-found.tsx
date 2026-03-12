import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-semibold">Ресторан не найден</h1>
      <p className="mt-3 text-gray-600">
        Возможно, страница была удалена или ссылка указана неверно.
      </p>
      <Link
        href="/almaty"
        className="mt-8 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
      >
        Вернуться к списку ресторанов
      </Link>
    </main>
  )
}
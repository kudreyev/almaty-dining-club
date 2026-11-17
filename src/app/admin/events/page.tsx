import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CITY_LABELS } from '@/lib/cities'
import { formatSetPrice } from '@/lib/events'

export default async function AdminEventsPage() {
  const { supabase } = await requireAdmin()
  const { data: events } = await supabase
    .from('events')
    .select(
      'id, slug, name, city, starts_at, ends_at, set_price_kzt, accent_color, is_published',
    )
    .order('starts_at', { ascending: false })

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Фестивали</h1>
        <Button href="/admin/events/new" size="sm">
          Новый фестиваль
        </Button>
      </div>

      <div className="space-y-3">
        {(events ?? []).map((event) => (
          <Card key={event.id} padding="sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{event.name}</p>
                  <Badge color={event.is_published ? 'green' : 'default'}>
                    {event.is_published ? 'опубликован' : 'черновик'}
                  </Badge>
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: event.accent_color }}
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {CITY_LABELS[event.city as 'almaty' | 'astana'] ?? event.city}
                  {' · '}
                  {event.starts_at} — {event.ends_at}
                  {' · '}
                  {formatSetPrice(event.set_price_kzt)}
                  {' · /'}
                  {event.city}/{event.slug}
                </p>
              </div>
              <Button href={`/admin/events/${event.id}`} variant="secondary" size="sm">
                Открыть
              </Button>
            </div>
          </Card>
        ))}
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Пока нет фестивалей.</p>
        ) : null}
      </div>

      <p className="mt-8 text-sm text-gray-400">
        <Link href="/admin/dashboard" className="underline">
          ← Дашборд
        </Link>
      </p>
    </div>
  )
}

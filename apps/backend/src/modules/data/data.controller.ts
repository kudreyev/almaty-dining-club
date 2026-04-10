import type { Request, Response } from 'express'
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/infrastructure/db/client'
import * as schema from '@/infrastructure/db/schema'

const tableMap: Record<string, unknown> = {
  profiles: schema.profiles,
  restaurants: schema.restaurants,
  restaurant_hours: schema.restaurantHours,
  restaurant_locations: schema.restaurantLocations,
  restaurant_photos: schema.restaurantPhotos,
  offers: schema.offers,
  redeem_tokens: schema.redeemTokens,
  redemptions: schema.redemptions,
  subscriptions: schema.subscriptions,
  activation_links: schema.activationLinks,
  analytics_events: schema.analyticsEvents,
  payment_requests: schema.paymentRequests,
  staff_users: schema.staffUsers,
  staff_sessions: schema.staffSessions,
}

const requestSchema = z.object({
  table: z.string(),
  action: z.enum(['select', 'insert', 'update', 'delete']),
  filters: z.array(z.object({ op: z.enum(['eq', 'gt']), column: z.string(), value: z.any() })).optional(),
  orderBy: z.object({ column: z.string(), ascending: z.boolean() }).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  values: z.record(z.string(), z.any()).optional(),
  single: z.boolean().optional(),
})

function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
}

function resolveColumn(table: Record<string, unknown>, column: string) {
  if (column in table) return table[column]

  const camel = snakeToCamel(column)
  if (camel in table) return table[camel]

  const aliases: Record<string, string[]> = {
    restaurant_name: ['restaurantName', 'name'],
    short_description: ['shortDescription', 'description'],
    offer_title: ['offerTitle', 'title'],
    offer_terms_short: ['offerTermsShort', 'description'],
    offer_type: ['offerType'],
  }

  for (const candidate of aliases[column] ?? []) {
    if (candidate in table) return table[candidate]
  }

  return null
}

function mapValuesForTable(
  table: Record<string, unknown>,
  values: Record<string, unknown> | undefined
) {
  if (!values) return {}

  const mappedEntries = Object.entries(values).flatMap(([key, value]) => {
    const column = resolveColumn(table, key)
    if (!column) return []

    const targetKey = Object.entries(table).find(([, candidate]) => candidate === column)?.[0]
    if (!targetKey) return []

    return [[targetKey, value] as const]
  })

  return Object.fromEntries(mappedEntries)
}

function toSnakeCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
}

function serializeRow<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => serializeRow(item)) as T
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const serialized = Object.fromEntries(
      Object.entries(record).map(([key, nested]) => [toSnakeCase(key), serializeRow(nested)])
    ) as Record<string, unknown>

    if ('restaurant_name' in serialized === false && typeof serialized.name === 'string') {
      serialized.restaurant_name = serialized.name
    }
    if ('short_description' in serialized === false && typeof serialized.description === 'string') {
      serialized.short_description = serialized.description
    }
    if ('offer_title' in serialized === false && typeof serialized.title === 'string') {
      serialized.offer_title = serialized.title
    }
    if (
      'offer_terms_short' in serialized === false &&
      typeof serialized.description === 'string'
    ) {
      serialized.offer_terms_short = serialized.description
    }
    if ('offer_type' in serialized === false && serialized.title != null) {
      serialized.offer_type = '2for1'
    }
    if ('city' in serialized === false) {
      serialized.city = 'almaty'
    }
    if ('address' in serialized === false) {
      serialized.address = ''
    }

    return serialized as T
  }

  return value
}

async function attachRestaurantRelations(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return rows

  const restaurantIds = rows
    .map((row) => String(row.id || ''))
    .filter(Boolean)

  if (restaurantIds.length === 0) return rows

  const [offersRows, hoursRows, locationRows] = await Promise.all([
    db.select().from(schema.offers).where(inArray(schema.offers.restaurantId, restaurantIds)),
    db.select().from(schema.restaurantHours).where(inArray(schema.restaurantHours.restaurantId, restaurantIds)),
    db.select().from(schema.restaurantLocations).where(inArray(schema.restaurantLocations.restaurantId, restaurantIds)),
  ])

  const groupByRestaurant = <T extends { restaurantId: string }>(items: T[]) => {
    const grouped = new Map<string, T[]>()
    for (const item of items) {
      const current = grouped.get(item.restaurantId) ?? []
      current.push(item)
      grouped.set(item.restaurantId, current)
    }
    return grouped
  }

  const offersByRestaurant = groupByRestaurant(offersRows)
  const hoursByRestaurant = groupByRestaurant(hoursRows)
  const locationsByRestaurant = groupByRestaurant(locationRows)

  return rows.map((row) => ({
    ...row,
    offers: offersByRestaurant.get(String(row.id)) ?? [],
    restaurantHours: hoursByRestaurant.get(String(row.id)) ?? [],
    restaurantLocations: locationsByRestaurant.get(String(row.id)) ?? [],
  }))
}

export class DataController {
  async query(req: Request, res: Response) {
    const body = requestSchema.parse(req.body)
    const table = tableMap[body.table] as Record<string, unknown> | undefined
    if (!table) {
      return res.status(400).json({ ok: false, error: `Unknown table: ${body.table}` })
    }

    if (body.action === 'select') {
      let builder = db.select().from(table as any) as any
      if (body.filters?.length) {
        const filters = body.filters.flatMap((f) => {
          const column = resolveColumn(table, f.column)
          if (!column) return []
          return [f.op === 'eq' ? eq(column as any, f.value) : gt(column as any, f.value)]
        })
        if (filters.length > 0) {
          builder = builder.where(and(...filters))
        }
      }
      if (body.orderBy) {
        const orderColumn = resolveColumn(table, body.orderBy.column)
        if (orderColumn) {
          builder = builder.orderBy(
            body.orderBy.ascending ? asc(orderColumn as any) : desc(orderColumn as any)
          )
        }
      }
      if (body.limit) {
        builder = builder.limit(body.limit)
      }
      const rows = await builder
      const enrichedRows =
        body.table === 'restaurants'
          ? await attachRestaurantRelations(rows as Record<string, unknown>[])
          : rows
      const serializedRows = serializeRow(enrichedRows)
      return res.status(200).json({ ok: true, data: body.single ? (serializedRows as any[])[0] ?? null : serializedRows })
    }

    if (body.action === 'insert') {
      const insertValues = mapValuesForTable(table, body.values)
      const insertedRows = (await db.insert(table as any).values(insertValues).returning()) as any[]
      const row = insertedRows[0] ?? null
      return res.status(200).json({ ok: true, data: serializeRow(row) })
    }

    if (body.action === 'update') {
      const updateValues = mapValuesForTable(table, body.values)
      let builder = db.update(table as any).set(updateValues) as any
      if (body.filters?.length) {
        const filters = body.filters.flatMap((f) => {
          const column = resolveColumn(table, f.column)
          if (!column) return []
          return [f.op === 'eq' ? eq(column as any, f.value) : gt(column as any, f.value)]
        })
        if (filters.length > 0) {
          builder = builder.where(and(...filters))
        } else {
          builder = builder.where(sql`1=1`)
        }
      } else {
        builder = builder.where(sql`1=1`)
      }
      const rows = await builder.returning()
      const serializedRows = serializeRow(rows)
      return res.status(200).json({ ok: true, data: body.single ? (serializedRows as any[])[0] ?? null : serializedRows })
    }

    let builder = db.delete(table as any) as any
    if (body.filters?.length) {
      const filters = body.filters.flatMap((f) => {
        const column = resolveColumn(table, f.column)
        if (!column) return []
        return [f.op === 'eq' ? eq(column as any, f.value) : gt(column as any, f.value)]
      })
      if (filters.length > 0) {
        builder = builder.where(and(...filters))
      } else {
        builder = builder.where(sql`1=1`)
      }
    } else {
      builder = builder.where(sql`1=1`)
    }
    await builder
    return res.status(200).json({ ok: true })
  }
}

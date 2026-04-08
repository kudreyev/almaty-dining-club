import type { Request, Response } from 'express'
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm'
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

export class DataController {
  async query(req: Request, res: Response) {
    const body = requestSchema.parse(req.body)
    const table = tableMap[body.table] as any
    if (!table) {
      return res.status(400).json({ ok: false, error: `Unknown table: ${body.table}` })
    }

    if (body.action === 'select') {
      let builder = db.select().from(table) as any
      if (body.filters?.length) {
        const filters = body.filters.map((f) =>
          f.op === 'eq' ? eq(table[f.column], f.value) : gt(table[f.column], f.value)
        )
        builder = builder.where(and(...filters))
      }
      if (body.orderBy) {
        builder = builder.orderBy(
          body.orderBy.ascending ? asc(table[body.orderBy.column]) : desc(table[body.orderBy.column])
        )
      }
      if (body.limit) {
        builder = builder.limit(body.limit)
      }
      const rows = await builder
      return res.status(200).json({ ok: true, data: body.single ? rows[0] ?? null : rows })
    }

    if (body.action === 'insert') {
      const insertedRows = (await db.insert(table).values(body.values ?? {}).returning()) as any[]
      const row = insertedRows[0] ?? null
      return res.status(200).json({ ok: true, data: row })
    }

    if (body.action === 'update') {
      let builder = db.update(table).set(body.values ?? {}) as any
      if (body.filters?.length) {
        const filters = body.filters.map((f) =>
          f.op === 'eq' ? eq(table[f.column], f.value) : gt(table[f.column], f.value)
        )
        builder = builder.where(and(...filters))
      } else {
        builder = builder.where(sql`1=1`)
      }
      const rows = await builder.returning()
      return res.status(200).json({ ok: true, data: body.single ? rows[0] ?? null : rows })
    }

    let builder = db.delete(table) as any
    if (body.filters?.length) {
      const filters = body.filters.map((f) =>
        f.op === 'eq' ? eq(table[f.column], f.value) : gt(table[f.column], f.value)
      )
      builder = builder.where(and(...filters))
    } else {
      builder = builder.where(sql`1=1`)
    }
    await builder
    return res.status(200).json({ ok: true })
  }
}

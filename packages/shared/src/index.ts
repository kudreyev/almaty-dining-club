import { z } from 'zod'

export const roleSchema = z.enum(['admin', 'user'])
export type Role = z.infer<typeof roleSchema>

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  timestamp: z.string(),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>

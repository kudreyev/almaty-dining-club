import { asc, eq } from 'drizzle-orm'
import { db } from '@/infrastructure/db/client'
import { restaurants } from '@/infrastructure/db/schema'

export class RestaurantsRepository {
  async listActive() {
    return db
      .select()
      .from(restaurants)
      .where(eq(restaurants.isActive, true))
      .orderBy(asc(restaurants.name))
  }
}

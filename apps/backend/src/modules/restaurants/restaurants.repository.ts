import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/infrastructure/db/client'
import {
  restaurantHours,
  restaurantLocations,
  restaurantPhotos,
  restaurants,
} from '@/infrastructure/db/schema'

export type RestaurantInput = {
  restaurantName: string
  slug: string
  address: string
  phone: string | null
  instagramUrl: string | null
  websiteUrl: string | null
  twoGisUrl: string | null
  cuisine: string
  cuisine2: string | null
  cuisine3: string | null
  shortDescription: string
  isActive: boolean
}

export type RestaurantHourInput = {
  dayOfWeek: number
  isClosed: boolean
  openTime: string | null
  closeTime: string | null
  closeNextDay: boolean
}

export class RestaurantsRepository {
  async listActive() {
    return db
      .select()
      .from(restaurants)
      .where(eq(restaurants.isActive, true))
      .orderBy(asc(restaurants.name))
  }

  async listAdmin() {
    return db
      .select()
      .from(restaurants)
      .orderBy(asc(restaurants.restaurantName))
  }

  async findById(id: string) {
    return db.query.restaurants.findFirst({
      where: eq(restaurants.id, id),
    })
  }

  async getHours(restaurantId: string) {
    return db
      .select()
      .from(restaurantHours)
      .where(eq(restaurantHours.restaurantId, restaurantId))
      .orderBy(asc(restaurantHours.dayOfWeek))
  }

  async getPrimaryLocation(restaurantId: string) {
    return db.query.restaurantLocations.findFirst({
      where: and(
        eq(restaurantLocations.restaurantId, restaurantId),
        eq(restaurantLocations.isActive, true)
      ),
      orderBy: (location, { asc }) => [asc(location.sortOrder)],
    })
  }

  async getPhotos(restaurantId: string) {
    return db
      .select()
      .from(restaurantPhotos)
      .where(and(eq(restaurantPhotos.restaurantId, restaurantId), eq(restaurantPhotos.isActive, true)))
      .orderBy(asc(restaurantPhotos.sortOrder))
  }

  async getLastPhoto(restaurantId: string) {
    return db.query.restaurantPhotos.findFirst({
      where: and(eq(restaurantPhotos.restaurantId, restaurantId), eq(restaurantPhotos.isActive, true)),
      orderBy: (photo, { desc }) => [desc(photo.sortOrder)],
    })
  }

  async create(input: RestaurantInput) {
    const [restaurant] = await db
      .insert(restaurants)
      .values({
        name: input.restaurantName,
        restaurantName: input.restaurantName,
        slug: input.slug,
        city: 'almaty',
        address: input.address,
        phone: input.phone,
        instagramUrl: input.instagramUrl,
        websiteUrl: input.websiteUrl,
        twoGisUrl: input.twoGisUrl,
        cuisine: input.cuisine,
        cuisine2: input.cuisine2,
        cuisine3: input.cuisine3,
        description: input.shortDescription,
        shortDescription: input.shortDescription,
        isActive: input.isActive,
      })
      .returning()
    return restaurant
  }

  async update(id: string, input: RestaurantInput) {
    const [restaurant] = await db
      .update(restaurants)
      .set({
        name: input.restaurantName,
        restaurantName: input.restaurantName,
        slug: input.slug,
        address: input.address,
        phone: input.phone,
        instagramUrl: input.instagramUrl,
        websiteUrl: input.websiteUrl,
        twoGisUrl: input.twoGisUrl,
        cuisine: input.cuisine,
        cuisine2: input.cuisine2,
        cuisine3: input.cuisine3,
        description: input.shortDescription,
        shortDescription: input.shortDescription,
        isActive: input.isActive,
      })
      .where(eq(restaurants.id, id))
      .returning()
    return restaurant
  }

  async replaceHours(restaurantId: string, hours: RestaurantHourInput[]) {
    await db.delete(restaurantHours).where(eq(restaurantHours.restaurantId, restaurantId))
    if (hours.length === 0) return
    await db.insert(restaurantHours).values(
      hours.map((hour) => ({
        restaurantId,
        dayOfWeek: hour.dayOfWeek,
        isClosed: hour.isClosed,
        openTime: hour.openTime,
        closeTime: hour.closeTime,
        closeNextDay: hour.closeNextDay,
      }))
    )
  }

  async upsertPrimaryLocation(args: {
    restaurantId: string
    address: string
    lat: number | null
    lng: number | null
  }) {
    const existing = await this.getPrimaryLocation(args.restaurantId)
    if (existing) {
      await db
        .update(restaurantLocations)
        .set({ address: args.address, lat: args.lat, lng: args.lng })
        .where(eq(restaurantLocations.id, existing.id))
      return
    }

    if (args.lat == null || args.lng == null) return

    await db.insert(restaurantLocations).values({
      restaurantId: args.restaurantId,
      address: args.address,
      lat: args.lat,
      lng: args.lng,
      isActive: true,
      sortOrder: 0,
    })
  }

  async insertPhoto(args: {
    restaurantId: string
    publicUrl: string
    storagePath: string
    thumbUrl: string
    fullUrl: string
    thumbPath: string
    fullPath: string
    sortOrder: number
  }) {
    const [photo] = await db
      .insert(restaurantPhotos)
      .values({
        restaurantId: args.restaurantId,
        publicUrl: args.publicUrl,
        storagePath: args.storagePath,
        thumbUrl: args.thumbUrl,
        fullUrl: args.fullUrl,
        thumbPath: args.thumbPath,
        fullPath: args.fullPath,
        sortOrder: args.sortOrder,
        isActive: true,
      })
      .returning()
    return photo
  }
}

import type { Request, Response } from 'express'
import { z } from 'zod'
import { uploadPublicObject } from '@/infrastructure/storage/s3'
import { RestaurantsService } from '@/modules/restaurants/restaurants.service'

const restaurantsService = new RestaurantsService()

const restaurantInputSchema = z.object({
  restaurant_name: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().nullable().optional(),
  instagram_url: z.string().nullable().optional(),
  website_url: z.string().nullable().optional(),
  two_gis_url: z.string().nullable().optional(),
  cuisine: z.string().min(1),
  cuisine_2: z.string().nullable().optional(),
  cuisine_3: z.string().nullable().optional(),
  short_description: z.string().min(1),
  is_active: z.boolean(),
  hours: z.array(z.object({
    day_of_week: z.number().int().min(1).max(7),
    is_closed: z.boolean(),
    open_time: z.string().nullable(),
    close_time: z.string().nullable(),
    close_next_day: z.boolean(),
  })).default([]),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
})

const photosUploadSchema = z.object({
  files: z.array(z.object({
    thumbBase64: z.string().min(1),
    fullBase64: z.string().min(1),
  })).min(1).max(10),
})

function serializeRestaurant(row: any) {
  return {
    id: row.id,
    restaurant_name: row.restaurantName ?? row.name,
    slug: row.slug,
    city: row.city,
    district: row.district,
    address: row.address,
    phone: row.phone,
    instagram_url: row.instagramUrl,
    website_url: row.websiteUrl,
    two_gis_url: row.twoGisUrl,
    cuisine: row.cuisine,
    cuisine_2: row.cuisine2,
    cuisine_3: row.cuisine3,
    short_description: row.shortDescription ?? row.description,
    is_active: row.isActive,
    created_at: row.createdAt,
  }
}

function serializeHour(row: any) {
  return {
    id: row.id,
    restaurant_id: row.restaurantId,
    day_of_week: row.dayOfWeek,
    is_closed: row.isClosed,
    open_time: row.openTime,
    close_time: row.closeTime,
    close_next_day: row.closeNextDay,
    created_at: row.createdAt,
  }
}

function serializeLocation(row: any) {
  if (!row) return null
  return {
    id: row.id,
    restaurant_id: row.restaurantId,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    is_active: row.isActive,
    sort_order: row.sortOrder,
    created_at: row.createdAt,
  }
}

function serializePhoto(row: any) {
  return {
    id: row.id,
    restaurant_id: row.restaurantId,
    public_url: row.publicUrl,
    storage_path: row.storagePath,
    thumb_url: row.thumbUrl,
    full_url: row.fullUrl,
    thumb_path: row.thumbPath,
    full_path: row.fullPath,
    sort_order: row.sortOrder,
    is_active: row.isActive,
    created_at: row.createdAt,
  }
}

function toServiceInput(body: z.infer<typeof restaurantInputSchema>) {
  return {
    restaurantName: body.restaurant_name,
    slug: body.slug,
    address: body.address,
    phone: body.phone ?? null,
    instagramUrl: body.instagram_url ?? null,
    websiteUrl: body.website_url ?? null,
    twoGisUrl: body.two_gis_url ?? null,
    cuisine: body.cuisine,
    cuisine2: body.cuisine_2 ?? null,
    cuisine3: body.cuisine_3 ?? null,
    shortDescription: body.short_description,
    isActive: body.is_active,
  }
}

function toServiceHours(body: z.infer<typeof restaurantInputSchema>) {
  return body.hours.map((hour) => ({
    dayOfWeek: hour.day_of_week,
    isClosed: hour.is_closed,
    openTime: hour.open_time,
    closeTime: hour.close_time,
    closeNextDay: hour.close_next_day,
  }))
}

function getParamId(req: Request) {
  const id = req.params.id
  return Array.isArray(id) ? id[0] : id
}

export class RestaurantsController {
  async list(_req: Request, res: Response) {
    const data = await restaurantsService.listActiveRestaurants()
    return res.status(200).json({ ok: true, data: data.map(serializeRestaurant) })
  }

  async listAdmin(_req: Request, res: Response) {
    const data = await restaurantsService.listAdminRestaurants()
    return res.status(200).json({ ok: true, data: data.map(serializeRestaurant) })
  }

  async getAdmin(req: Request, res: Response) {
    const id = getParamId(req)
    const result = await restaurantsService.getAdminRestaurant(id)
    if (!result) return res.status(404).json({ ok: false, error: 'Restaurant not found' })

    return res.status(200).json({
      ok: true,
      data: {
        restaurant: serializeRestaurant(result.restaurant),
        restaurant_hours: result.restaurantHours.map(serializeHour),
        primary_location: serializeLocation(result.primaryLocation),
        photos: result.photos.map(serializePhoto),
      },
    })
  }

  async create(req: Request, res: Response) {
    const body = restaurantInputSchema.parse(req.body)
    const restaurant = await restaurantsService.createRestaurant(
      toServiceInput(body),
      toServiceHours(body)
    )
    return res.status(201).json({ ok: true, data: serializeRestaurant(restaurant) })
  }

  async update(req: Request, res: Response) {
    const body = restaurantInputSchema.parse(req.body)
    const id = getParamId(req)
    const restaurant = await restaurantsService.updateRestaurant({
      id,
      input: toServiceInput(body),
      hours: toServiceHours(body),
      lat: body.lat ?? null,
      lng: body.lng ?? null,
    })
    if (!restaurant) return res.status(404).json({ ok: false, error: 'Restaurant not found' })
    return res.status(200).json({ ok: true, data: serializeRestaurant(restaurant) })
  }

  async uploadPhotos(req: Request, res: Response) {
    const body = photosUploadSchema.parse(req.body)
    const id = getParamId(req)
    const restaurant = await restaurantsService.getRestaurantOrNull(id)
    if (!restaurant) return res.status(404).json({ ok: false, error: 'Restaurant not found' })

    let nextSortOrder = await restaurantsService.getNextPhotoSortOrder(id)
    const photos = []

    for (const file of body.files) {
      const timestamp = Date.now()
      const random = crypto.randomUUID()
      const thumbPath = `restaurants/${id}/thumb-${timestamp}-${random}.webp`
      const fullPath = `restaurants/${id}/full-${timestamp}-${random}.webp`

      const thumbUrl = await uploadPublicObject({
        key: thumbPath,
        body: Buffer.from(file.thumbBase64, 'base64'),
        contentType: 'image/webp',
      })
      const fullUrl = await uploadPublicObject({
        key: fullPath,
        body: Buffer.from(file.fullBase64, 'base64'),
        contentType: 'image/webp',
      })

      const photo = await restaurantsService.insertPhoto({
        restaurantId: id,
        publicUrl: fullUrl,
        storagePath: fullPath,
        thumbUrl,
        fullUrl,
        thumbPath,
        fullPath,
        sortOrder: nextSortOrder,
      })
      photos.push(serializePhoto(photo))
      nextSortOrder += 1
    }

    return res.status(201).json({ ok: true, data: { restaurant: serializeRestaurant(restaurant), photos } })
  }
}

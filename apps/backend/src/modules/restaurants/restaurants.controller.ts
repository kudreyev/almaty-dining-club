import type { Request, Response } from 'express'
import { RestaurantsService } from '@/modules/restaurants/restaurants.service'

const restaurantsService = new RestaurantsService()

export class RestaurantsController {
  async list(_req: Request, res: Response) {
    const data = await restaurantsService.listActiveRestaurants()
    return res.status(200).json({ ok: true, data })
  }
}

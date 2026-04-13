import { Router } from 'express'
import { requireAdmin } from '@/common/middleware/auth'
import { RestaurantsController } from '@/modules/restaurants/restaurants.controller'

const controller = new RestaurantsController()
export const restaurantsRouter = Router()

restaurantsRouter.get('/', controller.list.bind(controller))
restaurantsRouter.get('/admin', requireAdmin, controller.listAdmin.bind(controller))
restaurantsRouter.get('/admin/:id', requireAdmin, controller.getAdmin.bind(controller))
restaurantsRouter.post('/admin', requireAdmin, controller.create.bind(controller))
restaurantsRouter.put('/admin/:id', requireAdmin, controller.update.bind(controller))
restaurantsRouter.post('/admin/:id/photos', requireAdmin, controller.uploadPhotos.bind(controller))

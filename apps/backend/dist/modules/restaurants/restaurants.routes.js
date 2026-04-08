import { Router } from 'express';
import { RestaurantsController } from '@/modules/restaurants/restaurants.controller';
const controller = new RestaurantsController();
export const restaurantsRouter = Router();
restaurantsRouter.get('/', controller.list.bind(controller));

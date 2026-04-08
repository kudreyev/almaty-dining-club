import { RestaurantsService } from '@/modules/restaurants/restaurants.service';
const restaurantsService = new RestaurantsService();
export class RestaurantsController {
    async list(_req, res) {
        const data = await restaurantsService.listActiveRestaurants();
        return res.status(200).json({ ok: true, data });
    }
}

import { RestaurantsRepository } from '@/modules/restaurants/restaurants.repository';
export class RestaurantsService {
    restaurantsRepository;
    constructor(restaurantsRepository = new RestaurantsRepository()) {
        this.restaurantsRepository = restaurantsRepository;
    }
    async listActiveRestaurants() {
        return this.restaurantsRepository.listActive();
    }
}

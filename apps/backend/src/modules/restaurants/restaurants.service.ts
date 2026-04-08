import { RestaurantsRepository } from '@/modules/restaurants/restaurants.repository'

export class RestaurantsService {
  constructor(private readonly restaurantsRepository = new RestaurantsRepository()) {}

  async listActiveRestaurants() {
    return this.restaurantsRepository.listActive()
  }
}

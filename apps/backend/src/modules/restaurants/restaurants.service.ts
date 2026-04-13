import {
  type RestaurantHourInput,
  type RestaurantInput,
  RestaurantsRepository,
} from '@/modules/restaurants/restaurants.repository'

export class RestaurantsService {
  constructor(private readonly restaurantsRepository = new RestaurantsRepository()) {}

  async listActiveRestaurants() {
    return this.restaurantsRepository.listActive()
  }

  async listAdminRestaurants() {
    return this.restaurantsRepository.listAdmin()
  }

  async getAdminRestaurant(id: string) {
    const restaurant = await this.restaurantsRepository.findById(id)
    if (!restaurant) return null

    const [restaurantHours, primaryLocation, photos] = await Promise.all([
      this.restaurantsRepository.getHours(id),
      this.restaurantsRepository.getPrimaryLocation(id),
      this.restaurantsRepository.getPhotos(id),
    ])

    return {
      restaurant,
      restaurantHours,
      primaryLocation,
      photos,
    }
  }

  async createRestaurant(input: RestaurantInput, hours: RestaurantHourInput[]) {
    const restaurant = await this.restaurantsRepository.create(input)
    await this.restaurantsRepository.replaceHours(restaurant.id, hours)
    return restaurant
  }

  async updateRestaurant(args: {
    id: string
    input: RestaurantInput
    hours: RestaurantHourInput[]
    lat: number | null
    lng: number | null
  }) {
    const restaurant = await this.restaurantsRepository.update(args.id, args.input)
    if (!restaurant) return null

    await this.restaurantsRepository.replaceHours(args.id, args.hours)
    await this.restaurantsRepository.upsertPrimaryLocation({
      restaurantId: args.id,
      address: args.input.address,
      lat: args.lat,
      lng: args.lng,
    })

    return restaurant
  }

  async getRestaurantOrNull(id: string) {
    return this.restaurantsRepository.findById(id)
  }

  async getNextPhotoSortOrder(restaurantId: string) {
    const lastPhoto = await this.restaurantsRepository.getLastPhoto(restaurantId)
    return (lastPhoto?.sortOrder ?? -1) + 1
  }

  async insertPhoto(args: Parameters<RestaurantsRepository['insertPhoto']>[0]) {
    return this.restaurantsRepository.insertPhoto(args)
  }
}

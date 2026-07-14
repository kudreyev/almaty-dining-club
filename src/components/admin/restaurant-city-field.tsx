import { CITIES, CITY_LABELS, DEFAULT_CITY, type City } from '@/lib/cities'

export function RestaurantCityField({ defaultCity = DEFAULT_CITY }: { defaultCity?: City }) {
  return (
    <div>
      <label htmlFor="city" className="mb-1.5 block text-base font-medium text-gray-700">
        Город
      </label>
      <select
        id="city"
        name="city"
        defaultValue={defaultCity}
        required
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent"
      >
        {CITIES.map((city) => (
          <option key={city} value={city}>
            {CITY_LABELS[city]}
          </option>
        ))}
      </select>
    </div>
  )
}

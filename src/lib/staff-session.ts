import { cookies } from 'next/headers'

const STAFF_SESSION_COOKIE = 'staff_session_restaurant_id'

export async function setStaffSession(restaurantId: string) {
  const cookieStore = await cookies()

  cookieStore.set(STAFF_SESSION_COOKIE, restaurantId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
  })
}

export async function clearStaffSession() {
  const cookieStore = await cookies()
  cookieStore.delete(STAFF_SESSION_COOKIE)
}

export async function getStaffSessionRestaurantId() {
  const cookieStore = await cookies()
  return cookieStore.get(STAFF_SESSION_COOKIE)?.value ?? null
}
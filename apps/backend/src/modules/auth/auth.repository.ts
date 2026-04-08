import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/infrastructure/db/client'
import { sessions, users } from '@/infrastructure/db/schema'

export class AuthRepository {
  async findUserByPhone(phone: string) {
    return db.query.users.findFirst({
      where: eq(users.phone, phone),
    })
  }

  async createUser(phone: string) {
    const [user] = await db
      .insert(users)
      .values({
        phone,
      })
      .returning()
    return user
  }

  async insertSession(args: { userId: string; tokenHash: string; expiresAt: Date }) {
    const [session] = await db
      .insert(sessions)
      .values({
        userId: args.userId,
        tokenHash: args.tokenHash,
        expiresAt: args.expiresAt,
      })
      .returning()
    return session
  }

  async getSession(tokenHash: string) {
    const now = new Date()
    return db.query.sessions.findFirst({
      where: and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)),
    })
  }
}

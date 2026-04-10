import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/infrastructure/db/client'
import { loginChallenges, sessions, users } from '@/infrastructure/db/schema'

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

  async revokeActiveChallenges(phone: string) {
    await db
      .update(loginChallenges)
      .set({ revokedAt: new Date() })
      .where(and(eq(loginChallenges.phone, phone), isNull(loginChallenges.revokedAt), isNull(loginChallenges.consumedAt)))
  }

  async insertLoginChallenge(args: { phone: string; codeHash: string; expiresAt: Date }) {
    const [challenge] = await db
      .insert(loginChallenges)
      .values({
        phone: args.phone,
        codeHash: args.codeHash,
        expiresAt: args.expiresAt,
      })
      .returning()
    return challenge
  }

  async getActiveChallenge(phone: string) {
    const now = new Date()
    return db.query.loginChallenges.findFirst({
      where: and(
        eq(loginChallenges.phone, phone),
        isNull(loginChallenges.revokedAt),
        isNull(loginChallenges.consumedAt),
        gt(loginChallenges.expiresAt, now)
      ),
      orderBy: (challenge, { desc }) => [desc(challenge.createdAt)],
    })
  }

  async incrementChallengeAttempts(id: string, attempts: number) {
    const [challenge] = await db
      .update(loginChallenges)
      .set({ attempts })
      .where(eq(loginChallenges.id, id))
      .returning()
    return challenge
  }

  async consumeChallenge(id: string) {
    const [challenge] = await db
      .update(loginChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(loginChallenges.id, id))
      .returning()
    return challenge
  }

  async revokeChallenge(id: string) {
    const [challenge] = await db
      .update(loginChallenges)
      .set({ revokedAt: new Date() })
      .where(eq(loginChallenges.id, id))
      .returning()
    return challenge
  }
}

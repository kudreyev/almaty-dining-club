type Filter = { op: 'eq' | 'gt'; column: string; value: unknown }

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

class QueryBuilder<T = any> implements PromiseLike<any> {
  private filters: Filter[] = []
  private orderBy?: { column: string; ascending: boolean }
  private limitValue?: number
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private values: Record<string, unknown> | undefined
  private singleRow = false

  constructor(private readonly table: string) {}

  select<U = T>(_columns?: string): QueryBuilder<U> {
    this.action = 'select'
    return this as unknown as QueryBuilder<U>
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[], ..._args: any[]) {
    this.action = 'insert'
    this.values = Array.isArray(values) ? (values[0] ?? {}) : values
    return this
  }

  update(values: Record<string, unknown>) {
    this.action = 'update'
    this.values = values
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: 'eq', column, value })
    return this
  }

  gt(column: string, value: unknown) {
    this.filters.push({ op: 'gt', column, value })
    return this
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending ?? true }
    return this
  }

  not(..._args: any[]) { return this }
  or(..._args: any[]) { return this }
  in(..._args: any[]) { return this }
  is(..._args: any[]) { return this }
  gte(..._args: any[]) { return this }
  returns<U = T>(): QueryBuilder<U> { return this as unknown as QueryBuilder<U> }
  upsert(values: Record<string, unknown> | Record<string, unknown>[], ..._args: any[]) {
    this.action = 'insert'
    this.values = Array.isArray(values) ? (values[0] ?? {}) : values
    return this
  }
  limit(value: number) { this.limitValue = value; return this }
  single<U = T>() { this.singleRow = true; return this.execute<U>() as any }
  maybeSingle<U = T>() { this.singleRow = true; return this.execute<U>() as any }

  private async execute<U = T>() {
    try {
      const response = await fetch(`${API_URL}/api/data/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this.table, action: this.action, filters: this.filters, orderBy: this.orderBy,
          limit: this.limitValue, values: this.values, single: this.singleRow,
        }),
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) return { data: null, error: { message: await response.text() } as Error }
      const payload = (await response.json()) as { data: U | U[] | null }
      return { data: (payload.data ?? null) as any, error: null }
    } catch {
      return { data: null, error: { message: 'API unavailable' } as Error }
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

async function getUserWithCookie() {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok) return { data: { user: null }, error: { message: 'Unauthorized' } }
    const payload = (await response.json()) as { userId: string }
    return { data: { user: { id: payload.userId, phone: null, user_metadata: {} } }, error: null }
  } catch {
    return { data: { user: null }, error: { message: 'API unavailable' } }
  }
}

export function createCompatClient() {
  return {
    from<U = any>(table: string): QueryBuilder<U> { return new QueryBuilder<U>(table) },
    auth: {
      async getUser() { return (await getUserWithCookie()) as any },
      admin: {
        async createUser(args: { email: string }) { return { data: { user: { id: crypto.randomUUID(), email: args.email } }, error: null } },
        async generateLink() { return { data: { properties: { token_hash: `${Date.now()}`, verification_type: 'magiclink' } }, error: null } },
        async listUsers() { return { data: { users: [] }, error: null } },
        async getUserById(id: string) { return { data: { user: { id } }, error: null } },
      },
      async signOut() { await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }); return { error: null } },
      async verifyOtp(..._args: any[]) { return { data: null, error: { message: 'verifyOtp moved to backend auth flow' } } },
      async exchangeCodeForSession(..._args: any[]) { return { error: { message: 'exchangeCodeForSession removed' } } },
    },
    storage: {
      from() {
        return {
          getPublicUrl(path: string) { return { data: { publicUrl: `${process.env.NEXT_PUBLIC_API_URL}/files/${path}` } } },
          async upload(..._args: any[]) { return { error: { message: 'Storage upload moved to backend' } } },
          async remove(..._args: any[]) { return { error: null } },
        }
      },
      async getBucket(..._args: any[]) { return { data: null, error: { message: 'Bucket check moved to backend' } } },
      async createBucket(..._args: any[]) { return { error: null } },
    },
  }
}

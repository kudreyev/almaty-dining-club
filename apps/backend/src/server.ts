import { env } from '@/common/config/env'
import { createApp } from '@/app'

const app = createApp()

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${env.PORT}`)
})

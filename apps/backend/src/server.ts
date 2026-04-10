import { env } from '@/common/config/env'
import { createApp } from '@/app'

const app = createApp()

app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT}`)
  console.log(
    JSON.stringify({
      scope: 'startup',
      service: 'backend',
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      frontendUrl: env.FRONTEND_URL,
      appUrl: env.APP_URL,
      authDebug: env.AUTH_DEBUG,
    })
  )
})

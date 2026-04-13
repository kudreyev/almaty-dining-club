import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { env } from '@/common/config/env'
import { errorHandler } from '@/common/middleware/error-handler'
import { requestContext } from '@/common/middleware/request-context'
import { apiRouter } from '@/routes'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  )
  app.use(helmet())
  app.use(express.json({ limit: '25mb' }))
  app.use(cookieParser())
  app.use(requestContext)
  app.use(
    pinoHttp({
      quietReqLogger: true,
    })
  )

  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'backend',
      timestamp: new Date().toISOString(),
    })
  })

  app.use('/api', apiRouter)
  app.use(errorHandler)

  return app
}

import { Router } from 'express'
import { authRouter } from '@/modules/auth/auth.routes'
import { dataRouter } from '@/modules/data/data.routes'
import { restaurantsRouter } from '@/modules/restaurants/restaurants.routes'

export const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/data', dataRouter)
apiRouter.use('/restaurants', restaurantsRouter)

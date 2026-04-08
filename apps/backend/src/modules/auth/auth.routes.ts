import { Router } from 'express'
import { AuthController } from '@/modules/auth/auth.controller'

const authController = new AuthController()
export const authRouter = Router()

authRouter.post('/login', authController.login.bind(authController))
authRouter.get('/me', authController.me.bind(authController))
authRouter.post('/logout', authController.logout.bind(authController))

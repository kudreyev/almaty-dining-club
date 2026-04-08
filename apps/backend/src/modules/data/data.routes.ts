import { Router } from 'express'
import { DataController } from '@/modules/data/data.controller'

const controller = new DataController()
export const dataRouter = Router()

dataRouter.post('/query', controller.query.bind(controller))

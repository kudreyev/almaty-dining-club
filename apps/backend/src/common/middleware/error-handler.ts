import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '@/common/errors/http-error'

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      ok: false,
      error: err.message,
      details: err.details ?? null,
    })
  }

  console.error(
    JSON.stringify({
      scope: 'error',
      at: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      error: err instanceof Error ? err.message : 'Internal server error',
      stack: err instanceof Error ? err.stack : null,
    })
  )

  return res.status(500).json({
    ok: false,
    error: err instanceof Error ? err.message : 'Internal server error',
  })
}

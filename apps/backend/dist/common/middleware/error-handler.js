import { HttpError } from '@/common/errors/http-error';
export function errorHandler(err, _req, res, _next) {
    if (err instanceof HttpError) {
        return res.status(err.statusCode).json({
            ok: false,
            error: err.message,
            details: err.details ?? null,
        });
    }
    return res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Internal server error',
    });
}

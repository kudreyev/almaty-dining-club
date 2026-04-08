import crypto from 'node:crypto';
export function requestContext(req, res, next) {
    const requestId = req.header('x-request-id') ?? crypto.randomUUID();
    res.setHeader('x-request-id', requestId);
    req.requestId = requestId;
    next();
}

// Purpose: GET /api/health. Returns { status: "ok" } and nothing else. Public, no session, no database.
// Rules: standards/api.md (problem+json with the request id as instance), spec S01 section 3.
import { requirePermission } from '@/contracts/permissions';
import { toResponse } from '@/lib/errors';
import { logger } from '@/lib/logger';

export function GET(request: Request): Response {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    requirePermission(null, 'public');
    return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } });
  } catch (err) {
    logger.child(requestId).error('health.failed', { err });
    return toResponse(err, requestId);
  }
}

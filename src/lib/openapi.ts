// Purpose: the OpenAPI registry. Register each public HTTP route here, with schemas from src/contracts.
// Rules: standards/api.md (OpenAPI 3.1 from zod schemas). Server actions are not a public API, so they are not listed.
// Only public route in E-001: GET /api/health. No env, no database, no next/* here, so the generator runs anywhere.
// Source: https://github.com/asteasolutions/zod-to-openapi
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

/** Body of GET /api/health. */
export const HealthResponse = z.strictObject({ status: z.literal('ok') }).openapi('HealthResponse');

/** The registry. Add one registerPath call per public route. */
export const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'Health check',
  description: 'Returns ok when the web process is up. No sign-in needed.',
  responses: {
    200: {
      description: 'The service is up.',
      content: { 'application/json': { schema: HealthResponse } },
    },
  },
});

/** Build the OpenAPI 3.1 document from the registry. */
export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Room booking API',
      version: '1.0.0',
      description: 'Public HTTP routes only. Pages use server actions, which are not listed here.',
    },
  });
}

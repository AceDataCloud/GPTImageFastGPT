import { expect, test, vi } from 'vitest';
import { projectOperation, fromPublicApi, renderCatalog, OPERATIONS } from './sync-model-catalog.mjs';

function spec(path, models) {
  return { paths: { [path]: { post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Input' } } } }, responses: { 200: { model: { enum: ['response-only'] } } } } } }, components: { schemas: { Input: { type: 'object', required: ['prompt', 'model'], properties: { model: { enum: models }, quality: { enum: ['auto'] } } } } } };
}

test('projects request enums through references and ignores response examples', () => {
  expect(projectOperation(spec('/image', ['future-model']), '/image')).toEqual({ models: ['future-model'], qualities: ['auto'] });
  expect(() => projectOperation(spec('/image', []), '/image')).toThrow('nonempty');
});

test('public refresh reads only anonymous metadata and retains each operation', async () => {
  const fetcher = vi.fn(async (url, options) => {
    expect(options).not.toHaveProperty('headers');
    const entry = Object.entries(OPERATIONS).find(([, operation]) => url.endsWith(`/${operation.apiId}/`));
    return Response.json({ definition: spec(entry[1].path, [`future-${entry[0]}`]) });
  });
  const result = await fromPublicApi(fetcher);
  expect(result.operations.generation.models).toEqual(['future-generation']);
  expect(result.operations.edit.models).toEqual(['future-edit']);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(renderCatalog(result)).toContain('"future-edit"');
});

test('metadata failure cannot produce an empty replacement catalog', async () => {
  await expect(fromPublicApi(async () => new Response('', { status: 503 }))).rejects.toThrow('HTTP 503');
  const invalid = spec('/image', ['future-model']);
  invalid.components.schemas.Input.required.push('unsupported_required_field');
  expect(() => projectOperation(invalid, '/image')).toThrow('Required API fields changed');
});

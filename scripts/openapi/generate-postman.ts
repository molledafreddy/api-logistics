/**
 * Postman collection generator
 * ----------------------------
 * Lee `docs/openapi.json` y produce:
 *   - docs/postman/api-logistics.postman_collection.json   (Collection v2.1)
 *   - docs/postman/api-logistics.postman_environment.json  (Environment con baseUrl + jwt)
 *
 * Características:
 *   - Carpetas por tag
 *   - Bearer auth a nivel colección (variable {{jwt}})
 *   - Path params → variables {{param}}
 *   - Query params → marcados como `disabled` para que el usuario los habilite
 *   - Request body de ejemplo generado a partir del schema (resolviendo $ref)
 *   - Test scripts:
 *       · Para POST /auth/login y /auth/refresh: guarda automáticamente
 *         `accessToken` en {{jwt}} y `refreshToken` en {{refreshToken}}
 *
 * Uso:
 *   pnpm openapi:postman           (regenera la colección)
 *   pnpm openapi:full              (genera spec + audit + postman)
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const SPEC_PATH = resolve(ROOT, 'docs', 'openapi.json');
const OUT_DIR = resolve(ROOT, 'docs', 'postman');
const COLLECTION_PATH = resolve(
  OUT_DIR,
  'api-logistics.postman_collection.json',
);
const ENV_PATH = resolve(OUT_DIR, 'api-logistics.postman_environment.json');

// ---------- helpers ----------

type AnyObj = Record<string, any>;

function loadSpec(): AnyObj {
  if (!existsSync(SPEC_PATH)) {
    throw new Error(
      `No existe ${SPEC_PATH}. Corre primero: pnpm openapi:generate`,
    );
  }
  return JSON.parse(readFileSync(SPEC_PATH, 'utf-8'));
}

function resolveRef(spec: AnyObj, ref: string): AnyObj | null {
  // ref like "#/components/schemas/Foo"
  if (!ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/');
  let cur: any = spec;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return cur ?? null;
}

/** Genera un valor de ejemplo a partir de un schema OpenAPI (resolviendo $ref). */
function exampleFromSchema(
  spec: AnyObj,
  schema: AnyObj | undefined,
  depth = 0,
): any {
  if (!schema || depth > 6) return null;

  if (schema.$ref) {
    const target = resolveRef(spec, schema.$ref);
    return exampleFromSchema(spec, target ?? undefined, depth + 1);
  }

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  if (schema.allOf?.length) {
    return schema.allOf.reduce((acc: any, s: any) => {
      const v = exampleFromSchema(spec, s, depth + 1);
      return v && typeof v === 'object' && !Array.isArray(v)
        ? { ...acc, ...v }
        : acc;
    }, {});
  }
  if (schema.oneOf?.length)
    return exampleFromSchema(spec, schema.oneOf[0], depth + 1);
  if (schema.anyOf?.length)
    return exampleFromSchema(spec, schema.anyOf[0], depth + 1);

  if (schema.enum?.length) return schema.enum[0];

  switch (schema.type) {
    case 'string':
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'date')
        return new Date().toISOString().slice(0, 10);
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uuid')
        return '00000000-0000-0000-0000-000000000000';
      if (schema.format === 'uri' || schema.format === 'url')
        return 'https://example.com';
      return schema.title ? `string-${schema.title}` : 'string';
    case 'integer':
    case 'number':
      return schema.minimum ?? 0;
    case 'boolean':
      return false;
    case 'array':
      return [exampleFromSchema(spec, schema.items, depth + 1)].filter(
        (x) => x !== null,
      );
    case 'object':
    default: {
      const props = schema.properties ?? {};
      const out: AnyObj = {};
      for (const [k, v] of Object.entries(props)) {
        out[k] = exampleFromSchema(spec, v as AnyObj, depth + 1);
      }
      return out;
    }
  }
}

/** Convierte "/users/{id}/posts" en ["users", ":id", "posts"] (formato Postman). */
function pathToPostmanSegments(path: string): string[] {
  return path
    .replace(/^\/+/, '')
    .split('/')
    .map((seg) =>
      seg.startsWith('{') && seg.endsWith('}') ? `:${seg.slice(1, -1)}` : seg,
    );
}

/** Extrae nombres de path params de "/users/{id}/posts" → ["id"]. */
function extractPathParams(path: string): string[] {
  const out: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) out.push(m[1]);
  return out;
}

// ---------- builders ----------

interface PostmanFolder {
  name: string;
  item: any[];
  description?: string;
}

function buildCollection(spec: AnyObj) {
  const info = spec.info ?? {};
  const title = info.title ?? 'API';
  const version = info.version ?? '0.0.0';

  const folders = new Map<string, PostmanFolder>();
  const ensureFolder = (tag: string): PostmanFolder => {
    if (!folders.has(tag)) folders.set(tag, { name: tag, item: [] });
    return folders.get(tag)!;
  };

  let opCount = 0;
  let withBodyCount = 0;
  let authedCount = 0;

  const paths = spec.paths ?? {};
  const methods = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'options',
    'head',
  ] as const;

  for (const [path, pathItem] of Object.entries<AnyObj>(paths)) {
    const pathParams = extractPathParams(path);

    for (const method of methods) {
      const op = pathItem[method] as AnyObj | undefined;
      if (!op) continue;
      opCount++;

      const tag = (op.tags && op.tags[0]) || 'default';
      const folder = ensureFolder(tag);

      const segments = pathToPostmanSegments(path);
      const url: AnyObj = {
        raw: `{{baseUrl}}${path.replace(/\{([^}]+)\}/g, ':$1')}`,
        host: ['{{baseUrl}}'],
        path: segments,
      };

      // path variables
      if (pathParams.length) {
        url.variable = pathParams.map((p) => ({
          key: p,
          value: '',
          description: `Path variable: ${p}`,
        }));
      }

      // query params (de op.parameters where in === 'query')
      const opParams: AnyObj[] = op.parameters ?? [];
      const queryParams = opParams.filter((p) => p.in === 'query');
      if (queryParams.length) {
        url.query = queryParams.map((q) => ({
          key: q.name,
          value: q.example ?? exampleFromSchema(spec, q.schema) ?? '',
          description: q.description ?? '',
          disabled: !q.required,
        }));
      }

      // headers (de op.parameters where in === 'header')
      const headerParams = opParams.filter((p) => p.in === 'header');
      const headers: AnyObj[] = headerParams.map((h) => ({
        key: h.name,
        value: String(h.example ?? exampleFromSchema(spec, h.schema) ?? ''),
        description: h.description ?? '',
        disabled: !h.required,
      }));

      // body
      let body: AnyObj | undefined;
      const reqBody = op.requestBody as AnyObj | undefined;
      const jsonContent = reqBody?.content?.['application/json'];
      if (jsonContent) {
        const example =
          jsonContent.example ??
          (jsonContent.examples &&
            Object.values<any>(jsonContent.examples)[0]?.value) ??
          exampleFromSchema(spec, jsonContent.schema);
        body = {
          mode: 'raw',
          raw: JSON.stringify(example ?? {}, null, 2),
          options: { raw: { language: 'json' } },
        };
        if (!headers.find((h) => h.key.toLowerCase() === 'content-type')) {
          headers.unshift({ key: 'Content-Type', value: 'application/json' });
        }
        withBodyCount++;
      }

      // auth: si la operación tiene security override [] → noauth
      let auth: AnyObj | undefined;
      if (Array.isArray(op.security) && op.security.length === 0) {
        auth = { type: 'noauth' };
      } else if (Array.isArray(op.security) && op.security.length > 0) {
        authedCount++;
      }

      // test script: extraer JWT si es endpoint de login/refresh
      const events: AnyObj[] = [];
      const isLogin =
        method === 'post' && /\/auth\/(login|refresh)/i.test(path);
      if (isLogin) {
        events.push({
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              'try {',
              '  const json = pm.response.json();',
              '  const access = json.accessToken || json.access_token || json.token || (json.data && json.data.accessToken);',
              '  const refresh = json.refreshToken || json.refresh_token || (json.data && json.data.refreshToken);',
              '  if (access) {',
              "    pm.environment.set('jwt', access);",
              "    pm.collectionVariables.set('jwt', access);",
              "    console.log('✅ jwt actualizado en environment');",
              '  }',
              '  if (refresh) {',
              "    pm.environment.set('refreshToken', refresh);",
              "    pm.collectionVariables.set('refreshToken', refresh);",
              '  }',
              '} catch (e) { console.warn("No se pudo parsear JWT del response:", e.message); }',
            ],
          },
        });
      }

      const item: AnyObj = {
        name: op.summary || `${method.toUpperCase()} ${path}`,
        request: {
          method: method.toUpperCase(),
          header: headers,
          url,
          ...(body ? { body } : {}),
          ...(auth ? { auth } : {}),
          description: op.description || op.summary || '',
        },
        response: [],
        ...(events.length ? { event: events } : {}),
      };

      folder.item.push(item);
    }
  }

  // ordenar carpetas alfabéticamente
  const items = Array.from(folders.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const collection = {
    info: {
      _postman_id: '00000000-0000-0000-0000-000000000001',
      name: `${title} v${version}`,
      description:
        (info.description ?? '') +
        '\n\nGenerado automáticamente desde `docs/openapi.json` por `scripts/openapi/generate-postman.ts`.',
      schema:
        'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{jwt}}', type: 'string' }],
    },
    event: [
      {
        listen: 'prerequest',
        script: { type: 'text/javascript', exec: [''] },
      },
    ],
    variable: [
      { key: 'baseUrl', value: 'http://localhost:3000/api/v1', type: 'string' },
      { key: 'jwt', value: '', type: 'string' },
      { key: 'refreshToken', value: '', type: 'string' },
    ],
    item: items,
  };

  return {
    collection,
    stats: { opCount, withBodyCount, authedCount, folders: folders.size },
  };
}

function buildEnvironment(spec: AnyObj) {
  const title = spec?.info?.title ?? 'API';
  return {
    id: '00000000-0000-0000-0000-000000000002',
    name: `${title} - Local`,
    values: [
      {
        key: 'baseUrl',
        value: 'http://localhost:3000/api/v1',
        enabled: true,
        type: 'default',
      },
      { key: 'jwt', value: '', enabled: true, type: 'secret' },
      { key: 'refreshToken', value: '', enabled: true, type: 'secret' },
    ],
    _postman_variable_scope: 'environment',
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: 'scripts/openapi/generate-postman.ts',
  };
}

// ---------- main ----------

function main() {
  console.log('📦 Generando colección Postman desde docs/openapi.json…');
  const spec = loadSpec();

  const { collection, stats } = buildCollection(spec);
  const env = buildEnvironment(spec);

  mkdirSync(dirname(COLLECTION_PATH), { recursive: true });
  writeFileSync(COLLECTION_PATH, JSON.stringify(collection, null, 2));
  writeFileSync(ENV_PATH, JSON.stringify(env, null, 2));

  console.log(`✅ Colección  → ${COLLECTION_PATH}`);
  console.log(`✅ Environment → ${ENV_PATH}`);
  console.log(
    `   Folders: ${stats.folders}   Operations: ${stats.opCount}   Con body: ${stats.withBodyCount}   Con auth: ${stats.authedCount}`,
  );
}

main();

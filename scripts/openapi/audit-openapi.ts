/**
 * Audits `docs/openapi.json` and writes `docs/openapi-audit.md` with findings.
 *
 * Checks per operation:
 *  - has `summary`
 *  - has `tags` (at least one)
 *  - has `operationId` (and unique)
 *  - has at least one 2xx response
 *  - has 401 if not in PUBLIC_PATHS (security required)
 *  - has 404 for paths with `:id` parameter
 *  - request body (POST/PUT/PATCH) has a referenced schema
 *
 * Exit codes:
 *  - 0  → no errors (warnings allowed)
 *  - 1  → at least one error finding
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

type Op = {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  responses?: Record<string, unknown>;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{ in: string; name: string; required?: boolean }>;
  requestBody?: {
    content?: Record<string, { schema?: { $ref?: string } }>;
  };
};

type Finding = {
  level: 'error' | 'warn';
  path: string;
  method: string;
  rule: string;
  msg: string;
};

// Endpoints sin auth (registro, login, healthcheck, etc.)
const PUBLIC_PATHS = [
  /^\/api\/v1\/?$/, // root smoke endpoint
  /^\/api\/v1\/health/i,
  /^\/api\/v1\/auth\/register/i,
  /^\/api\/v1\/auth\/login/i,
  /^\/api\/v1\/auth\/refresh/i,
  /^\/api\/v1\/users\/accept-invite/i,
  /^\/$/,
];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(path));
}

function audit(): number {
  const docPath = join(process.cwd(), 'docs', 'openapi.json');
  const doc = JSON.parse(readFileSync(docPath, 'utf-8')) as {
    paths: Record<string, Record<string, Op>>;
    components?: { schemas?: Record<string, unknown> };
  };

  const findings: Finding[] = [];
  const opIds = new Map<string, string[]>();

  let totalOps = 0;
  let withSummary = 0;
  let withDescription = 0;
  let withTags = 0;
  let withSecurity = 0;
  let with2xx = 0;

  const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

  for (const [path, item] of Object.entries(doc.paths || {})) {
    for (const method of methods) {
      const op = item[method];
      if (!op) continue;
      totalOps++;
      const id = `${method.toUpperCase()} ${path}`;

      // summary
      if (!op.summary || op.summary.trim().length === 0) {
        findings.push({
          level: 'error',
          path,
          method,
          rule: 'missing-summary',
          msg: 'No @ApiOperation({ summary }) declared',
        });
      } else {
        withSummary++;
      }

      // description (warn only)
      if (op.description && op.description.length > 10) withDescription++;

      // tags
      if (!op.tags || op.tags.length === 0) {
        findings.push({
          level: 'error',
          path,
          method,
          rule: 'missing-tag',
          msg: 'No @ApiTags() on controller',
        });
      } else {
        withTags++;
      }

      // operationId uniqueness
      if (op.operationId) {
        const arr = opIds.get(op.operationId) || [];
        arr.push(id);
        opIds.set(op.operationId, arr);
      }

      // responses
      const respCodes = Object.keys(op.responses || {});
      const has2xx = respCodes.some((c) => /^2\d\d$/.test(c));
      if (!has2xx) {
        findings.push({
          level: 'error',
          path,
          method,
          rule: 'missing-2xx',
          msg: `No 2xx response declared (got: ${respCodes.join(',') || 'none'})`,
        });
      } else {
        with2xx++;
      }

      // security
      const requiresAuth = !isPublic(path);
      const hasSecurity = Array.isArray(op.security) && op.security.length > 0;
      if (requiresAuth && !hasSecurity) {
        findings.push({
          level: 'warn',
          path,
          method,
          rule: 'missing-bearer',
          msg: 'No @ApiBearerAuth() on controller / endpoint',
        });
      }
      if (hasSecurity) withSecurity++;

      if (requiresAuth && !respCodes.includes('401')) {
        findings.push({
          level: 'warn',
          path,
          method,
          rule: 'missing-401',
          msg: 'Auth-protected endpoint should declare 401 response',
        });
      }

      // 404 on parametrized paths
      if (/\{[^}]+\}/.test(path) && method !== 'post') {
        if (!respCodes.includes('404')) {
          findings.push({
            level: 'warn',
            path,
            method,
            rule: 'missing-404',
            msg: 'Parametrized endpoint should declare 404 response',
          });
        }
      }

      // request body schema for write methods
      if (['post', 'put', 'patch'].includes(method) && op.requestBody) {
        const content = op.requestBody.content || {};
        const json = content['application/json'];
        if (json && !json.schema?.$ref) {
          findings.push({
            level: 'warn',
            path,
            method,
            rule: 'inline-body-schema',
            msg: 'Request body uses inline schema (prefer DTO with $ref)',
          });
        }
      }
    }
  }

  // duplicate operationIds
  for (const [opId, list] of opIds.entries()) {
    if (list.length > 1) {
      list.forEach(([, ...rest]) => {
        const [m, p] = list[0].split(' ');
        findings.push({
          level: 'error',
          path: p,
          method: m.toLowerCase(),
          rule: 'duplicate-operationId',
          msg: `operationId "${opId}" used by ${list.length} ops: ${list.join(' | ')}`,
        });
      });
      // keep just one finding per dup
      const seen = new Set<string>();
      for (let i = findings.length - 1; i >= 0; i--) {
        const f = findings[i];
        if (f.rule !== 'duplicate-operationId') continue;
        const key = `${opId}`;
        if (seen.has(key)) findings.splice(i, 1);
        else seen.add(key);
      }
    }
  }

  // ─── Report ─────────────────
  const errors = findings.filter((f) => f.level === 'error');
  const warns = findings.filter((f) => f.level === 'warn');

  const lines: string[] = [];
  lines.push('# OpenAPI Audit Report');
  lines.push('');
  lines.push(`_Generated: ${new Date().toISOString()}_`);
  lines.push('');
  lines.push('## 📊 Summary');
  lines.push('');
  lines.push(`- Total operations: **${totalOps}**`);
  lines.push(
    `- With \`summary\`:     ${withSummary} / ${totalOps} (${pct(withSummary, totalOps)}%)`,
  );
  lines.push(
    `- With \`description\`: ${withDescription} / ${totalOps} (${pct(withDescription, totalOps)}%)`,
  );
  lines.push(
    `- With \`tags\`:        ${withTags} / ${totalOps} (${pct(withTags, totalOps)}%)`,
  );
  lines.push(
    `- With \`security\`:    ${withSecurity} / ${totalOps} (${pct(withSecurity, totalOps)}%)`,
  );
  lines.push(
    `- With 2xx response:  ${with2xx} / ${totalOps} (${pct(with2xx, totalOps)}%)`,
  );
  lines.push('');
  lines.push(`- 🔴 Errors:   **${errors.length}**`);
  lines.push(`- 🟡 Warnings: **${warns.length}**`);
  lines.push('');

  // group by rule
  const byRule = new Map<string, Finding[]>();
  for (const f of findings) {
    const arr = byRule.get(f.rule) || [];
    arr.push(f);
    byRule.set(f.rule, arr);
  }

  if (byRule.size > 0) {
    lines.push('## 🔍 Findings by rule');
    lines.push('');
    for (const [rule, list] of [...byRule.entries()].sort()) {
      const lvl = list[0].level === 'error' ? '🔴' : '🟡';
      lines.push(`### ${lvl} \`${rule}\` — ${list.length} occurrences`);
      lines.push('');
      lines.push('| Method | Path | Detail |');
      lines.push('|---|---|---|');
      for (const f of list) {
        lines.push(
          `| \`${f.method.toUpperCase()}\` | \`${f.path}\` | ${f.msg} |`,
        );
      }
      lines.push('');
    }
  } else {
    lines.push('🎉 **No findings — OpenAPI spec is clean.**');
    lines.push('');
  }

  // Tag breakdown
  const tagCount = new Map<string, number>();
  for (const item of Object.values(doc.paths || {})) {
    for (const method of methods) {
      const op = item[method];
      if (!op) continue;
      for (const t of op.tags || ['(untagged)']) {
        tagCount.set(t, (tagCount.get(t) || 0) + 1);
      }
    }
  }
  lines.push('## 🏷️  Operations per tag');
  lines.push('');
  lines.push('| Tag | Operations |');
  lines.push('|---|---|');
  for (const [t, n] of [...tagCount.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${t} | ${n} |`);
  }
  lines.push('');

  const outPath = join(process.cwd(), 'docs', 'openapi-audit.md');
  writeFileSync(outPath, lines.join('\n'), 'utf-8');

  console.log(`📄 Report written → ${outPath}`);

  console.log(
    `   Errors: ${errors.length}   Warnings: ${warns.length}   Operations: ${totalOps}`,
  );

  return errors.length > 0 ? 1 : 0;
}

function pct(n: number, d: number): string {
  if (d === 0) return '0';
  return ((n / d) * 100).toFixed(1);
}

process.exit(audit());

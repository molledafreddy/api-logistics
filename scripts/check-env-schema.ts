import { validationSchema } from '../src/config/validation.schema';
import * as fs from 'fs';
import * as path from 'path';

const r = validationSchema.validate(
  { NODE_ENV: 'development' },
  { abortEarly: false, allowUnknown: true },
);
console.log(
  r.error
    ? '✅ Test 1 — env vacío rechazado con ' +
        r.error.details.length +
        ' errores (esperado)'
    : '❌ Test 1 — env vacío PASÓ (no debería)',
);

const env: Record<string, string> = {};
const examplePath = path.resolve(__dirname, '..', '.env.example');
fs.readFileSync(examplePath, 'utf8')
  .split('\n')
  .forEach((l: string) => {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  });
const r2 = validationSchema.validate(env, {
  abortEarly: false,
  allowUnknown: true,
});
console.log(
  r2.error
    ? '❌ Test 2 — .env.example INVÁLIDO: ' +
        r2.error.details.length +
        ' errores'
    : '✅ Test 2 — .env.example pasa la validación',
);
if (r2.error) {
  r2.error.details.slice(0, 10).forEach((d) => console.log('   •', d.message));
}

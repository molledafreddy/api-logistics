'use strict';
/**
 * Script de diagnóstico FCM — ejecutar desde api/ con:
 *   node scripts/test-fcm.cjs [FCM_TOKEN_OPCIONAL]
 *
 * Sin token: solo verifica que las credenciales son válidas (OAuth2).
 * Con token: envía un push real al dispositivo registrado.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') });
const admin = require('firebase-admin');

const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
const projectId = process.env.FIREBASE_PROJECT_ID || '';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';

// ── 1. Verificar que las variables están presentes ────────────────────────────
if (!projectId || !clientEmail || !rawKey) {
  console.error('❌ Faltan variables de entorno Firebase:');
  console.error('   FIREBASE_PROJECT_ID:', projectId || '(vacío)');
  console.error('   FIREBASE_CLIENT_EMAIL:', clientEmail || '(vacío)');
  console.error('   FIREBASE_PRIVATE_KEY:', rawKey ? `(${rawKey.length} chars)` : '(vacío)');
  process.exit(1);
}

// ── 2. Parsear la clave PEM ───────────────────────────────────────────────────
const privateKey = rawKey.replace(/\\n/g, '\n');
const newlineCount = (privateKey.match(/\n/g) || []).length;
console.log('🔑 Clave PEM:');
console.log('   raw length:', rawKey.length, '→ fixed length:', privateKey.length);
console.log('   newlines en clave:', newlineCount, newlineCount >= 25 ? '✅' : '❌ (esperado ≥25)');
console.log('   BEGIN header:', privateKey.startsWith('-----BEGIN PRIVATE KEY-----\n') ? '✅' : '❌');
console.log('   END footer:', privateKey.trimEnd().endsWith('-----END PRIVATE KEY-----') ? '✅' : '❌');

if (newlineCount < 25) {
  console.error('\n❌ La clave PEM está malformada. Revisar FIREBASE_PRIVATE_KEY en .env.development');
  process.exit(1);
}

// ── 3. Inicializar Firebase Admin ─────────────────────────────────────────────
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
  console.log('\n🔥 Firebase Admin inicializado OK');
} catch (e) {
  console.error('\n❌ initializeApp falló:', e.message);
  process.exit(1);
}

// ── 4. Verificar OAuth2 (confirma que Google acepta el service account) ───────
admin.app().options.credential.getAccessToken()
  .then(async (t) => {
    console.log('✅ OAuth2 token obtenido:', t.access_token.slice(0, 25) + '...');
    console.log('   (expira en:', new Date(t.expirationTime).toLocaleTimeString(), ')');

    // ── 5. Enviar push si se pasó un token ──────────────────────────────────
    const fcmToken = process.argv[2];
    if (!fcmToken) {
      console.log('\n💡 Para probar envío real: node scripts/test-fcm.cjs TU_FCM_TOKEN');
      console.log('   (obtén el token abriendo http://localhost:8080/fcm-web.html)');
      return;
    }

    console.log('\n📤 Enviando push a token:', fcmToken.slice(0, 20) + '...');
    try {
      const messageId = await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: '✅ FCM funcionando',
          body: 'Push enviado correctamente desde el backend de api-logistics',
        },
        data: {
          test: 'true',
          timestamp: Date.now().toString(),
        },
      });
      console.log('✅ Push enviado! messageId:', messageId);
    } catch (sendErr) {
      const code = sendErr.errorInfo?.code || sendErr.code || 'unknown';
      if (code === 'messaging/registration-token-not-registered') {
        console.log('⚠️  Token expirado o inválido — el Admin SDK SÍ se autenticó con Google.');
        console.log('   Genera un token nuevo abriendo fcm-web.html');
      } else if (code === 'messaging/invalid-recipient') {
        console.log('⚠️  Token con formato inválido — el Admin SDK SÍ se autenticó correctamente.');
        console.log('   Asegúrate de pegar el token FCM completo (≈150 chars)');
      } else {
        console.error('❌ Error enviando push:', code, '-', sendErr.message);
      }
    }
  })
  .catch((e) => {
    console.error('\n❌ OAuth2 falló — las credenciales son inválidas:');
    console.error('   ', e.message);
    console.log('\n🔍 Causas comunes:');
    console.log('   1. Service account JSON corrompido o de otro proyecto');
    console.log('   2. FIREBASE_PRIVATE_KEY mal escapada en .env.development');
    console.log('   3. Service account desactivado en Firebase Console');
    process.exit(1);
  });

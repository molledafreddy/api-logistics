export function buildReferralLandingHtml(
  token: string,
  apiBase: string,
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Únete a P&P Logis · Invitación</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      min-height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc; color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .page { min-height: 100vh; display: flex; flex-direction: column; }

    /* ════════ HEADER ════════ */
    .header {
      background: #7ee8a2;
      padding: 20px 20px 22px; position: relative; overflow: hidden;
    }
    .header::after {
      content: ''; position: absolute; right: -40px; top: -40px;
      width: 160px; height: 160px; border-radius: 50%;
      background: rgba(255,255,255,.06); pointer-events: none;
    }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .brand-logo {
      width: 40px; height: 40px; object-fit: contain; flex-shrink: 0;
      border-radius: 8px; background: rgba(255,255,255,.9); padding: 2px;
    }
    .brand-name    { font-size: 16px; font-weight: 700; color: #0f172a; }
    .brand-tagline { font-size: 11px; color: #166534; margin-top: 1px; }
    .mode-chip {
      display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px;
      font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 99px;
      background: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.6); color: #14532d;
    }
    .discount-hero-header {
      background: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.6);
      border-radius: 14px; padding: 16px; backdrop-filter: blur(8px);
      display: flex; align-items: center; gap: 16px;
    }
    .discount-pct-badge {
      background: rgba(255,255,255,.5); border: 2px solid rgba(255,255,255,.7);
      border-radius: 12px; padding: 10px 14px; text-align: center; flex-shrink: 0;
    }
    .discount-pct-num   { font-size: 28px; font-weight: 800; color: #14532d; line-height: 1; }
    .discount-pct-label { font-size: 9px; color: #166534; font-weight: 600; letter-spacing: .05em; }
    .discount-info-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 3px; }
    .discount-info-sub   { font-size: 12px; color: #166534; line-height: 1.4; }
    .discount-expiry     { font-size: 11px; color: #14532d; margin-top: 5px; }

    /* ════════ BODY ════════ */
    .body { flex: 1; padding: 20px 16px 8px; max-width: 520px; margin: 0 auto; width: 100%; }

    /* ── Form card ── */
    .form-card {
      background: #fff; border-radius: 18px; padding: 24px;
      box-shadow: 0 2px 16px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04);
      margin-bottom: 16px;
    }
    .form-title { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .form-sub   { font-size: 13px; color: #64748b; margin-bottom: 20px; line-height: 1.4; }

    .section-label {
      font-size: 10px; font-weight: 700; color: #94a3b8;
      letter-spacing: .1em; text-transform: uppercase;
      margin-bottom: 12px; margin-top: 20px;
    }
    .section-label:first-of-type { margin-top: 0; }

    .row { display: flex; gap: 12px; }
    .row .field { flex: 1; }

    .field { margin-bottom: 14px; }
    .field label {
      display: block; font-size: 12px; font-weight: 600; color: #374151;
      margin-bottom: 5px;
    }
    .field input, .field select {
      width: 100%; padding: 10px 13px; border-radius: 10px; font-size: 14px;
      border: 1.5px solid #e2e8f0; background: #fff; color: #0f172a;
      transition: border-color .15s, box-shadow .15s; outline: none;
      appearance: none; -webkit-appearance: none;
    }
    .field input:focus, .field select:focus {
      border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.12);
    }
    .field input.error, .field select.error { border-color: #ef4444; }
    .field-error { font-size: 11px; color: #ef4444; margin-top: 4px; display: none; }
    .field-error.show { display: block; }

    /* Password strength */
    .pwd-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .pwd-chip {
      font-size: 11px; padding: 3px 9px; border-radius: 99px;
      border: 1px solid #e2e8f0; color: #94a3b8; background: #f8fafc;
      transition: all .2s;
    }
    .pwd-chip.ok { background: #dcfce7; border-color: #86efac; color: #166534; }

    /* Submit button */
    .submit-btn {
      width: 100%; padding: 14px; border-radius: 12px; border: none;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
      transition: transform .1s, box-shadow .1s; margin-top: 8px;
      box-shadow: 0 4px 12px rgba(22,163,74,.3);
    }
    .submit-btn:hover   { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(22,163,74,.35); }
    .submit-btn:active  { transform: translateY(0); }
    .submit-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }

    /* Inline API error */
    .api-error {
      display: none; background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 10px; padding: 12px 14px; margin-top: 12px;
      font-size: 13px; color: #dc2626; line-height: 1.4;
    }
    .api-error.show { display: block; }

    /* ── Success state ── */
    .success-card {
      background: #fff; border-radius: 18px; overflow: hidden;
      box-shadow: 0 2px 16px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04);
      margin-bottom: 16px; display: none;
    }
    .success-hero {
      background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
      padding: 36px 24px; text-align: center;
    }
    .success-icon   { font-size: 52px; margin-bottom: 12px; }
    .success-title  { font-size: 22px; font-weight: 800; color: #15803d; margin-bottom: 6px; }
    .success-sub    { font-size: 14px; color: #166534; line-height: 1.5; }
    .success-body   { padding: 24px; }
    .success-label  { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }

    .download-btn {
      display: flex; align-items: center; gap: 14px;
      background: #0f172a; border-radius: 14px; padding: 14px 18px;
      text-decoration: none; margin-bottom: 10px; transition: transform .1s;
      position: relative;
    }
    .download-btn:hover  { transform: translateY(-1px); }
    .download-btn.alt    { background: #fff; border: 1.5px solid #e2e8f0; }
    .download-btn-icon   { flex-shrink: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
    .download-btn-label  { font-size: 10px; color: rgba(255,255,255,.6); }
    .download-btn.alt .download-btn-label { color: #94a3b8; }
    .download-btn-name   { font-size: 15px; font-weight: 700; color: #fff; }
    .download-btn.alt .download-btn-name  { color: #0f172a; }
    .soon-badge {
      position: absolute; top: -8px; right: 12px;
      font-size: 10px; font-weight: 700; letter-spacing: .04em;
      padding: 2px 8px; border-radius: 99px;
      background: #facc15; color: #713f12;
    }
    .soon-badge-alt { background: #fef9c3; color: #854d0e; }
    .app-note { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 8px; line-height: 1.4; }

    /* ── Error/invalid state ── */
    .error-card {
      background: #fff; border-radius: 18px; padding: 40px 24px; text-align: center;
      box-shadow: 0 2px 16px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04);
      margin-bottom: 16px; display: none;
    }
    .error-icon  { font-size: 52px; margin-bottom: 12px; }
    .error-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
    .error-sub   { font-size: 13px; color: #64748b; line-height: 1.5; }

    /* ════════ FOOTER ════════ */
    .footer { background: #7ee8a2; padding: 20px; margin-top: 24px; }
    .footer-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .footer-brand-logo {
      width: 28px; height: 28px; object-fit: contain; flex-shrink: 0;
      border-radius: 6px; background: rgba(255,255,255,.9); padding: 2px;
    }
    .footer-brand-name { font-size: 13px; font-weight: 700; color: #0f172a; }
    .footer-divider    { height: 1px; background: rgba(20,83,45,.15); margin: 10px 0; }
    .footer-hint       { font-size: 11px; color: #166534; }

    /* Skeleton */
    .skeleton {
      display: inline-block; border-radius: 6px;
      background: linear-gradient(90deg,#dcfce7 25%,#bbf7d0 50%,#dcfce7 75%);
      background-size: 200% 100%; animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

    .loading-card {
      background: #fff; border-radius: 18px; padding: 32px 24px;
      box-shadow: 0 2px 16px rgba(0,0,0,.06); text-align: center;
    }
  </style>
</head>
<body>
<div class="page" id="page">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      <img class="brand-logo" src="/public/logo.png" alt="P&P Logis" />
      <div>
        <div class="brand-name">P&amp;P Logis</div>
        <div class="brand-tagline">Plataforma de gestión de transporte</div>
      </div>
    </div>
    <div class="mode-chip">🔗 Invitación de referido</div>
    <div class="discount-hero-header" id="header-card">
      <div class="discount-pct-badge">
        <div class="discount-pct-num" id="discount-pct"><span class="skeleton" style="width:36px;height:28px">&nbsp;</span></div>
        <div class="discount-pct-label">% OFF</div>
      </div>
      <div>
        <div class="discount-info-title">Descuento en tu primer mes</div>
        <div class="discount-info-sub" id="header-sub">Verificando código de invitación…</div>
        <div class="discount-expiry" id="header-expiry"></div>
      </div>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- Loading -->
    <div id="loading-state" class="loading-card">
      <div style="margin-bottom:16px"><span class="skeleton" style="width:60px;height:60px;border-radius:50%">&nbsp;</span></div>
      <span class="skeleton" style="width:55%;height:14px;display:block;margin:0 auto 8px">&nbsp;</span>
      <span class="skeleton" style="width:80%;height:11px;display:block;margin:0 auto">&nbsp;</span>
    </div>

    <!-- Invalid token -->
    <div id="invalid-state" class="error-card">
      <div class="error-icon" id="invalid-icon">🚫</div>
      <div class="error-title" id="invalid-title">Código no válido</div>
      <div class="error-sub" id="invalid-sub">Este link de invitación no existe, ya fue utilizado o expiró.</div>
    </div>

    <!-- Registration form (shown when token valid) -->
    <div id="form-state" class="form-card" style="display:none">
      <div class="form-title">Crea tu cuenta</div>
      <div class="form-sub">Tu descuento se aplicará automáticamente al activar tu plan.</div>

      <div class="section-label">Tus datos</div>

      <div class="row">
        <div class="field">
          <label for="firstName">Nombre</label>
          <input type="text" id="firstName" placeholder="Juan" autocomplete="given-name" />
          <div class="field-error" id="err-firstName">Mínimo 2 caracteres</div>
        </div>
        <div class="field">
          <label for="lastName">Apellido</label>
          <input type="text" id="lastName" placeholder="Pérez" autocomplete="family-name" />
          <div class="field-error" id="err-lastName">Mínimo 2 caracteres</div>
        </div>
      </div>

      <div class="field">
        <label for="email">Correo electrónico</label>
        <input type="email" id="email" placeholder="juan@ejemplo.com" autocomplete="email" />
        <div class="field-error" id="err-email">Ingresa un email válido</div>
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <input type="password" id="password" placeholder="••••••••" autocomplete="new-password" />
        <div class="pwd-chips" id="pwd-chips">
          <span class="pwd-chip" id="pwd-len">8+ caracteres</span>
          <span class="pwd-chip" id="pwd-upper">Mayúscula</span>
          <span class="pwd-chip" id="pwd-lower">Minúscula</span>
          <span class="pwd-chip" id="pwd-num">Número</span>
          <span class="pwd-chip" id="pwd-special">Especial (@$!%*?&)</span>
        </div>
        <div class="field-error" id="err-password">La contraseña no cumple los requisitos</div>
      </div>

      <div class="field">
        <label for="confirmPassword">Confirmar contraseña</label>
        <input type="password" id="confirmPassword" placeholder="••••••••" autocomplete="new-password" />
        <div class="field-error" id="err-confirmPassword">Las contraseñas no coinciden</div>
      </div>

      <div class="section-label">Tu negocio</div>

      <div class="field">
        <label for="companyName">Nombre de empresa / negocio</label>
        <input type="text" id="companyName" placeholder="Transportes Pérez" />
        <div class="field-error" id="err-companyName">Mínimo 2 caracteres</div>
      </div>

      <div class="field">
        <label for="companyType">Tipo de empresa</label>
        <select id="companyType">
          <option value="carrier">Transportista (Carrier)</option>
          <option value="broker">Intermediario (Broker)</option>
          <option value="shipper">Embarcador (Shipper)</option>
          <option value="owner_operator">Dueño-operador</option>
        </select>
      </div>

      <button class="submit-btn" id="submit-btn" onclick="handleSubmit()">
        Crear cuenta con descuento
      </button>
      <div class="api-error" id="api-error"></div>
    </div>

    <!-- Success state -->
    <div id="success-state" class="success-card">
      <div class="success-hero">
        <div class="success-icon">🎉</div>
        <div class="success-title">¡Cuenta creada!</div>
        <div class="success-sub">Tu descuento está aplicado y se activará al elegir tu plan.</div>
      </div>
      <div class="success-body">
        <div class="success-label">Descarga la app para comenzar</div>
        <a href="https://apps.apple.com/app/logistics-driver/id000000000" target="_blank" rel="noopener" class="download-btn" id="ios-btn">
          <div class="download-btn-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.37 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
          </div>
          <div>
            <div class="download-btn-label">Disponible en</div>
            <div class="download-btn-name">App Store</div>
          </div>
          <div class="soon-badge">Próximamente</div>
        </a>
        <a href="https://play.google.com/store/apps/details?id=com.logistics.driver" target="_blank" rel="noopener" class="download-btn alt" id="android-btn">
          <div class="download-btn-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.18 23.76c.3.17.64.21.97.13l12.44-7.19-2.66-2.67-10.75 9.73z" fill="#EA4335"/>
              <path d="M22.33 10.5l-3.12-1.8-2.95 2.95 2.95 2.95 3.15-1.82c.9-.52.9-1.76-.03-2.28z" fill="#FBBC04"/>
              <path d="M1.87.44C1.57.75 1.4 1.22 1.4 1.83v20.34c0 .61.17 1.08.49 1.39l.07.07L14.04 12v-.29L1.94.37l-.07.07z" fill="#4285F4"/>
              <path d="M16.59 15.7l-2.55-2.55V11.7L16.59 9.15l.07.04 3.02 1.74c.86.49.86 1.3 0 1.79l-3.02 1.74-.07.04z" fill="#34A853"/>
            </svg>
          </div>
          <div>
            <div class="download-btn-label">Disponible en</div>
            <div class="download-btn-name">Google Play</div>
          </div>
          <div class="soon-badge soon-badge-alt">Próximamente</div>
        </a>
        <div class="app-note">
          Inicia sesión con el correo y contraseña que registraste.<br>
          Tu descuento se aplica automáticamente en el primer cobro.
        </div>
      </div>
    </div>

  </div><!-- /body -->

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-brand">
      <img class="footer-brand-logo" src="/public/logo.png" alt="P&P Logis" />
      <div class="footer-brand-name">P&amp;P Logis</div>
    </div>
    <div class="footer-divider"></div>
    <div class="footer-hint">Esta invitación fue generada por un usuario de la plataforma.</div>
  </div>

</div><!-- /page -->

<script>
  const TOKEN    = ${JSON.stringify(token)};
  const API_BASE = ${JSON.stringify(apiBase)};
  const VALIDATE_URL = API_BASE + '/referrals/links/validate?token=' + encodeURIComponent(TOKEN);
  const REGISTER_URL = API_BASE + '/auth/register';

  /* ── Validation helpers ── */
  const pwdRules = {
    'pwd-len':     p => p.length >= 8,
    'pwd-upper':   p => /[A-Z]/.test(p),
    'pwd-lower':   p => /[a-z]/.test(p),
    'pwd-num':     p => /[0-9]/.test(p),
    'pwd-special': p => /[@$!%*?&]/.test(p),
  };

  function isPwdValid(p) { return Object.values(pwdRules).every(fn => fn(p)); }

  document.getElementById('password')?.addEventListener('input', function() {
    const p = this.value;
    Object.entries(pwdRules).forEach(([id, fn]) => {
      document.getElementById(id)?.classList.toggle('ok', fn(p));
    });
  });

  function fieldError(id, msg, show) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg || el.textContent;
    el.classList.toggle('show', show);
    document.getElementById(id.replace('err-', ''))?.classList.toggle('error', show);
  }

  function clearErrors() {
    ['firstName','lastName','email','password','confirmPassword','companyName'].forEach(f => {
      fieldError('err-' + f, '', false);
    });
    const apiErr = document.getElementById('api-error');
    if (apiErr) { apiErr.classList.remove('show'); apiErr.textContent = ''; }
  }

  function validate() {
    let ok = true;
    const v = id => document.getElementById(id)?.value?.trim() ?? '';

    if (v('firstName').length < 2)    { fieldError('err-firstName','Mínimo 2 caracteres',true);  ok=false; }
    if (v('lastName').length < 2)     { fieldError('err-lastName','Mínimo 2 caracteres',true);   ok=false; }
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v('email'))) {
      fieldError('err-email','Ingresa un email válido',true); ok=false;
    }
    if (!isPwdValid(v('password')))   { fieldError('err-password','La contraseña no cumple los requisitos',true); ok=false; }
    if (v('password') !== v('confirmPassword')) {
      fieldError('err-confirmPassword','Las contraseñas no coinciden',true); ok=false;
    }
    if (v('companyName').length < 2)  { fieldError('err-companyName','Mínimo 2 caracteres',true); ok=false; }
    return ok;
  }

  /* ── Token validation on load ── */
  async function init() {
    if (!TOKEN) { showInvalid('🔍','Enlace inválido','Este enlace no contiene un código de invitación.'); return; }

    try {
      const res = await fetch(VALIDATE_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const env = await res.json();
      const d = env.data ?? env;

      if (!d.valid) {
        const exp = d.expiresAt && new Date(d.expiresAt) < new Date();
        showInvalid(
          exp ? '⏰' : '🚫',
          exp ? 'Código expirado' : 'Código no válido',
          exp
            ? 'Este link de invitación ya venció. Solicita uno nuevo al remitente.'
            : 'Este link no existe o ya fue utilizado. Verifica que el enlace sea correcto.',
        );
        return;
      }

      /* Valid token — update header and show form */
      document.getElementById('discount-pct').textContent = d.referredDiscountPct + '%';
      document.getElementById('header-sub').textContent   =
        'Regístrate ahora y obtén ' + d.referredDiscountPct + '% OFF en tu primer mes';
      const exp = new Date(d.expiresAt);
      document.getElementById('header-expiry').textContent =
        'Oferta válida hasta el ' + exp.toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'});

      document.getElementById('loading-state').style.display = 'none';
      document.getElementById('form-state').style.display    = 'block';
    } catch(e) {
      showInvalid('⚠️','Error de conexión','No se pudo verificar el código. Intenta recargar la página.');
    }
  }

  function showInvalid(icon, title, sub) {
    document.getElementById('loading-state').style.display  = 'none';
    document.getElementById('invalid-icon').textContent     = icon;
    document.getElementById('invalid-title').textContent    = title;
    document.getElementById('invalid-sub').textContent      = sub;
    document.getElementById('invalid-state').style.display  = 'block';
    document.getElementById('discount-pct').textContent     = '—';
    document.getElementById('header-sub').textContent       = 'Código no disponible';
  }

  /* ── Registration submit ── */
  async function handleSubmit() {
    clearErrors();
    if (!validate()) return;

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Creando cuenta…';

    const body = {
      firstName:    document.getElementById('firstName').value.trim(),
      lastName:     document.getElementById('lastName').value.trim(),
      email:        document.getElementById('email').value.trim().toLowerCase(),
      password:     document.getElementById('password').value,
      companyName:  document.getElementById('companyName').value.trim(),
      companyType:  document.getElementById('companyType').value,
      referralToken: TOKEN,
    };

    try {
      const res  = await fetch(REGISTER_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const env  = await res.json();
      const data = env.data ?? env;

      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message[0] : (data.message || 'Error al crear la cuenta.');
        if (res.status === 409) {
          showApiError('Este email ya está registrado. ¿Ya tienes cuenta? Descarga la app e inicia sesión.');
        } else {
          showApiError(msg);
        }
        btn.disabled = false;
        btn.textContent = 'Crear cuenta con descuento';
        return;
      }

      /* Success */
      document.getElementById('form-state').style.display    = 'none';
      document.getElementById('success-state').style.display = 'block';
    } catch(e) {
      showApiError('Error de red. Verifica tu conexión e intenta de nuevo.');
      btn.disabled = false;
      btn.textContent = 'Crear cuenta con descuento';
    }
  }

  function showApiError(msg) {
    const el = document.getElementById('api-error');
    el.textContent = msg;
    el.classList.add('show');
  }

  init();
</script>
</body>
</html>`;
}

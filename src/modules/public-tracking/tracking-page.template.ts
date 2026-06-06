export function buildTrackingPageHtml(token: string, apiBase: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Seguimiento · Logistics</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      min-height: 100%; height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0fdf4; color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .page { min-height: 100vh; display: flex; flex-direction: column; }

    /* ════════ HEADER ════════ */
    .header {
      background: linear-gradient(135deg, #166534 0%, #15803d 100%);
      padding: 20px 20px 22px;
      position: relative; overflow: hidden;
    }
    .header::after {
      content: ''; position: absolute; right: -40px; top: -40px;
      width: 160px; height: 160px; border-radius: 50%;
      background: rgba(255,255,255,.06); pointer-events: none;
    }

    /* Brand row */
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    .brand-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.2);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .brand-name    { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: -.2px; }
    .brand-tagline { font-size: 11px; color: rgba(255,255,255,.55); margin-top: 1px; }

    /* Mode chip — shown inside header */
    .mode-chip {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 600;
      padding: 4px 10px; border-radius: 99px;
      background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.2);
      color: rgba(255,255,255,.9); margin-bottom: 14px;
    }

    /* Info card inside header */
    .header-card {
      background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.15);
      border-radius: 14px; padding: 14px 16px;
      backdrop-filter: blur(8px); position: relative; z-index: 1;
    }
    .header-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .tracking-label { font-size: 10px; font-weight: 600; color: rgba(255,255,255,.5); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 3px; }
    .tracking-code  { font-size: 15px; font-weight: 700; color: #fff; }
    .address { margin-top: 8px; font-size: 13px; color: rgba(255,255,255,.8); line-height: 1.4; display: flex; gap: 5px; }
    .desc    { margin-top: 6px; font-size: 12px; color: rgba(255,255,255,.6); font-style: italic; line-height: 1.35; }
    .badge {
      flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; font-weight: 700; padding: 4px 11px; border-radius: 99px;
      background: rgba(255,255,255,.18); color: #fff; border: 1px solid rgba(255,255,255,.25);
      white-space: nowrap;
    }
    .badge-dot       { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .badge-dot.pulse { animation: dotPulse 1.8s ease-in-out infinite; }
    @keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:.35} }

    /* ════════ BODY ════════ */
    .body { flex: 1; padding: 20px 16px 8px; max-width: 520px; margin: 0 auto; width: 100%; }

    /* Alert banner */
    .alert-banner {
      display: none; align-items: flex-start; gap: 12px;
      background: #fff; border-radius: 14px; padding: 14px 16px;
      margin-bottom: 16px; border-left: 4px solid #ef4444;
      box-shadow: 0 2px 12px rgba(0,0,0,.06);
    }
    .alert-banner.show      { display: flex; }
    .alert-banner.cancelled { border-left-color: #94a3b8; }
    .alert-icon  { font-size: 22px; flex-shrink: 0; line-height: 1; }
    .alert-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 3px; }
    .alert-sub   { font-size: 13px; color: #64748b; line-height: 1.4; }

    /* Stepper card */
    .stepper-card {
      background: #fff; border-radius: 18px;
      padding: 4px 20px; overflow: hidden;
      box-shadow: 0 2px 16px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04);
    }

    .step { display: flex; gap: 16px; position: relative; padding: 18px 0; }
    .step:not(:last-child) { border-bottom: 1px solid #f1f5f9; }

    .step-circle {
      width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; background: #f8fafc; border: 2px solid #e2e8f0;
      transition: all .3s; align-self: flex-start; margin-top: 2px;
    }
    .step.done .step-circle {
      background: #dcfce7; border-color: #22c55e;
      font-size: 0;   /* hide emoji, show checkmark via pseudo */
    }
    .step.done .step-circle::after {
      content: '✓'; font-size: 20px; font-weight: 700; color: #16a34a;
    }
    .step.active .step-circle {
      background: linear-gradient(135deg,#22c55e,#16a34a);
      border-color: #22c55e; font-size: 22px;
      box-shadow: 0 0 0 6px rgba(34,197,94,.15);
      animation: stepGlow 2.2s ease-in-out infinite;
    }
    .step.pending .step-circle { opacity: .45; }
    .step.incident .step-circle { background: #fee2e2; border-color: #ef4444; }

    @keyframes stepGlow {
      0%,100% { box-shadow: 0 0 0 5px rgba(34,197,94,.15); }
      50%      { box-shadow: 0 0 0 13px rgba(34,197,94,.04); }
    }

    .step-body { flex: 1; min-width: 0; }
    .step-title { font-size: 14px; font-weight: 600; color: #94a3b8; transition: color .3s; line-height: 1.3; }
    .step.done   .step-title { color: #15803d; }
    .step.active .step-title { font-size: 16px; color: #0f172a; font-weight: 700; }
    .step-sub { margin-top: 4px; font-size: 12px; color: #cbd5e1; line-height: 1.4; }
    .step.done   .step-sub { color: #86efac; }
    .step.active .step-sub { color: #64748b; }

    /* Delivered timestamp */
    .step-time { margin-top: 5px; font-size: 11px; color: #22c55e; font-weight: 500; }

    /* Live location chip */
    .location-chip {
      display: none; align-items: center; gap: 7px;
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;
      padding: 8px 12px; font-size: 12px; color: #15803d;
      margin-top: 14px; font-weight: 500;
    }
    .location-chip.show { display: flex; }
    .live-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #22c55e; flex-shrink: 0;
      animation: dotPulse 1.8s ease-in-out infinite;
    }

    /* ════════ FOOTER ════════ */
    .footer { background: #14532d; padding: 20px 20px; margin-top: 24px; }
    .footer-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .footer-brand-icon {
      width: 28px; height: 28px; border-radius: 8px;
      background: rgba(255,255,255,.12);
      display: flex; align-items: center; justify-content: center;
    }
    .footer-brand-name { font-size: 13px; font-weight: 700; color: rgba(255,255,255,.85); }
    .footer-divider    { height: 1px; background: rgba(255,255,255,.1); margin: 10px 0; }
    .footer-row        { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .footer-hint       { font-size: 11px; color: rgba(255,255,255,.4); }
    .footer-hint span  { color: rgba(255,255,255,.6); }
    .refresh-btn {
      font-size: 11px; padding: 6px 14px; border-radius: 8px;
      background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15);
      color: rgba(255,255,255,.7); cursor: pointer; transition: all .15s;
    }
    .refresh-btn:hover { background: rgba(255,255,255,.2); color: #fff; }

    /* Skeleton */
    .skeleton {
      display: inline-block; border-radius: 6px;
      background: linear-gradient(90deg,#dcfce7 25%,#bbf7d0 50%,#dcfce7 75%);
      background-size: 200% 100%; animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

    /* Not found */
    .not-found {
      flex: 1; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 12px; padding: 40px; text-align: center;
    }
    .not-found-icon  { font-size: 56px; }
    .not-found-title { font-size: 18px; font-weight: 700; color: #0f172a; }
    .not-found-sub   { font-size: 13px; color: #64748b; }
  </style>
</head>
<body>
<div class="page" id="page">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      <div class="brand-icon" id="brand-icon">
        <!-- icon injected by JS -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M1 3h15v13H1V3z" stroke="white" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M16 8h4l3 4v4h-7V8z" stroke="white" stroke-width="1.8" stroke-linejoin="round"/>
          <circle cx="5.5" cy="18.5" r="2" stroke="white" stroke-width="1.8"/>
          <circle cx="18.5" cy="18.5" r="2" stroke="white" stroke-width="1.8"/>
        </svg>
      </div>
      <div>
        <div class="brand-name">Logistics</div>
        <div class="brand-tagline" id="brand-tagline">Seguimiento en tiempo real</div>
      </div>
    </div>

    <div class="mode-chip" id="mode-chip">
      <span id="mode-icon">📦</span>
      <span id="mode-label">Envío de paquete</span>
    </div>

    <div class="header-card">
      <div class="header-card-top">
        <div>
          <div class="tracking-label">Número de seguimiento</div>
          <div class="tracking-code" id="tracking-code">
            <span class="skeleton" style="width:160px;height:14px">&nbsp;</span>
          </div>
        </div>
        <div class="badge" id="status-badge">
          <div class="badge-dot pulse" id="badge-dot"></div>
          <span id="status-text">—</span>
        </div>
      </div>
      <div class="address">
        <span>📍</span>
        <span id="address-text"><span class="skeleton" style="width:200px;height:12px">&nbsp;</span></span>
      </div>
      <div class="desc" id="desc-text"></div>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <div class="alert-banner" id="alert-banner">
      <div class="alert-icon" id="alert-icon">⚠️</div>
      <div>
        <div class="alert-title" id="alert-title">Incidente</div>
        <div class="alert-sub"   id="alert-sub">El operador se comunicará contigo.</div>
      </div>
    </div>

    <div class="stepper-card">
      <div id="stepper">
        ${[1, 2, 3, 4]
          .map(
            () => `
          <div style="display:flex;gap:16px;align-items:center;padding:18px 0;border-bottom:1px solid #f1f5f9">
            <span class="skeleton" style="width:46px;height:46px;border-radius:50%;display:inline-block;flex-shrink:0">&nbsp;</span>
            <div style="flex:1;display:flex;flex-direction:column;gap:7px">
              <span class="skeleton" style="width:48%;height:13px">&nbsp;</span>
              <span class="skeleton" style="width:78%;height:11px">&nbsp;</span>
            </div>
          </div>`,
          )
          .join('')}
      </div>
    </div>

    <div class="location-chip" id="location-chip">
      <div class="live-dot"></div>
      <span id="location-text">Ubicación en vivo activa</span>
    </div>

  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-brand">
      <div class="footer-brand-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M1 3h15v13H1V3z" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linejoin="round"/>
          <path d="M16 8h4l3 4v4h-7V8z" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linejoin="round"/>
          <circle cx="5.5" cy="18.5" r="2" stroke="rgba(255,255,255,.8)" stroke-width="2"/>
          <circle cx="18.5" cy="18.5" r="2" stroke="rgba(255,255,255,.8)" stroke-width="2"/>
        </svg>
      </div>
      <div class="footer-brand-name">Logistics Software</div>
    </div>
    <div class="footer-divider"></div>
    <div class="footer-row">
      <div class="footer-hint">Última actualización: <span id="last-update">—</span></div>
      <button class="refresh-btn" onclick="fetchData()">↻ Actualizar</button>
    </div>
  </div>

</div>

<script>
  /* ─────────────────────────────────────
     CONFIGURACIÓN
  ───────────────────────────────────── */
  const TOKEN   = ${JSON.stringify(token)};
  const API_URL = ${JSON.stringify(apiBase)} + '/public/tracking/' + TOKEN;
  const POLL_MS = 10_000;

  let pollTimer, lastFetch;
  const FINAL     = new Set(['delivered','pod_uploaded','completed']);
  const CANCELLED = new Set(['cancelled']);
  const INCIDENT  = new Set(['incident']);

  /* ─────────────────────────────────────
     DETECCIÓN DE MODO
     freight | passenger | child
  ───────────────────────────────────── */
  const CHILD_KEYWORDS = [
    'niño','niña','niños','niñas','menor','menores',
    'estudiante','estudiantes','alumno','alumna','alumnos','alumnas',
    'escolar','escuela','colegio','jardín','kinder','jardín infantil',
    'child','children','school','student','kid','kids',
  ];

  function detectMode(cargoType, description) {
    if (cargoType !== 'passenger') return 'freight';
    const text = (description || '').toLowerCase();
    if (CHILD_KEYWORDS.some(k => text.includes(k))) return 'child';
    return 'passenger';
  }

  /* ─────────────────────────────────────
     DEFINICIÓN DE PASOS POR MODO
  ───────────────────────────────────── */
  const MODES = {
    freight: {
      chip:    { icon: '📦', label: 'Envío de paquete' },
      tagline: 'Seguimiento de envío',
      brandSvg: \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M1 3h15v13H1V3z" stroke="white" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M16 8h4l3 4v4h-7V8z" stroke="white" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="5.5" cy="18.5" r="2" stroke="white" stroke-width="1.8"/>
        <circle cx="18.5" cy="18.5" r="2" stroke="white" stroke-width="1.8"/>
      </svg>\`,
      steps: [
        { icon: '📦', title: 'Preparando envío',   sub: 'Tu paquete está siendo preparado para el despacho.' },
        { icon: '🚚', title: 'En camino',            sub: 'Tu paquete está en ruta hacia el destino.' },
        { icon: '📍', title: 'Cerca del destino',   sub: 'El conductor está a menos de 500 metros.' },
        { icon: '✅', title: 'Entregado',            sub: 'Tu paquete fue entregado exitosamente.' },
      ],
      incident: {
        title: 'Incidente en la entrega',
        sub: 'El conductor reportó un problema. El equipo se comunicará contigo a la brevedad.',
      },
      cancelled: {
        title: 'Envío cancelado',
        sub: 'Este envío fue cancelado. Contacta al operador para más información.',
      },
    },

    passenger: {
      chip:    { icon: '🧑', label: 'Transporte de pasajero' },
      tagline: 'Seguimiento de pasajero',
      brandSvg: \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="7" r="4" stroke="white" stroke-width="1.8"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
      </svg>\`,
      steps: [
        { icon: '🕐', title: 'Esperando conductor',  sub: 'Tu viaje fue confirmado y se asignará un conductor.' },
        { icon: '🚗', title: 'Conductor en camino',   sub: 'Tu conductor se dirige hacia tu ubicación.' },
        { icon: '📍', title: 'Conductor cercano',     sub: 'Tu conductor está a menos de 500 metros. ¡Prepárate!' },
        { icon: '🎯', title: 'Viaje completado',      sub: 'Has llegado a tu destino. ¡Buen viaje!' },
      ],
      incident: {
        title: 'Incidente en el viaje',
        sub: 'El conductor reportó un problema. El operador se comunicará contigo.',
      },
      cancelled: {
        title: 'Viaje cancelado',
        sub: 'Este viaje fue cancelado. Contacta al operador para más información.',
      },
    },

    child: {
      chip:    { icon: '🧒', label: 'Transporte escolar' },
      tagline: 'Seguimiento escolar',
      brandSvg: \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="6" r="3.5" stroke="white" stroke-width="1.8"/>
        <path d="M5 20.5c0-3.5 3.1-6.5 7-6.5s7 3 7 6.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M9 14l1.5 3 1.5-2 1.5 2L15 14" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>\`,
      steps: [
        { icon: '🏠', title: 'Esperando recogida',    sub: 'El conductor está en camino a recoger a tu hijo/a.' },
        { icon: '🚌', title: 'En camino al destino',  sub: 'Tu hijo/a está en el vehículo y en ruta al destino.' },
        { icon: '📍', title: 'A metros del destino',  sub: 'El vehículo está a menos de 500 metros. ¡Ya casi llega!' },
        { icon: '🏫', title: 'Llegó con seguridad',   sub: 'Tu hijo/a llegó a destino correctamente. ¡Todo bien!' },
      ],
      incident: {
        title: '⚠️ Atención — incidente reportado',
        sub: 'El conductor reportó una novedad. El operador se comunicará contigo de inmediato.',
      },
      cancelled: {
        title: 'Servicio cancelado',
        sub: 'Este servicio fue cancelado. Por favor comunícate con el operador.',
      },
    },
  };

  /* ─────────────────────────────────────
     STEP ACTIVO según status
  ───────────────────────────────────── */
  function getActiveStep(status, isNearby) {
    if (FINAL.has(status))                                  return 4;
    if (isNearby || status === 'at_stop')                   return 3;
    if (status === 'in_transit' || status === 'picked_up')  return 2;
    return 1;
  }

  const STATUS_LABELS = {
    draft: 'Borrador', pending_acceptance: 'Pendiente', confirmed: 'Confirmado',
    assigned: 'Asignado', picked_up: 'Recogido', in_transit: 'En camino',
    at_stop: 'En destino',
    delivered: 'Entregado', pod_uploaded: 'Entregado', completed: 'Completado',
    incident: 'Incidente', cancelled: 'Cancelado',
  };

  /* ─────────────────────────────────────
     RENDER
  ───────────────────────────────────── */
  function renderHeader(d, mode) {
    const cfg = MODES[mode];
    // Brand icon
    document.getElementById('brand-icon').innerHTML = cfg.brandSvg;
    document.getElementById('brand-tagline').textContent = cfg.tagline;
    // Mode chip
    document.getElementById('mode-icon').textContent  = cfg.chip.icon;
    document.getElementById('mode-label').textContent = cfg.chip.label;
    // Tracking info
    document.getElementById('tracking-code').textContent = d.trackingCode || TOKEN.slice(0,8).toUpperCase();
    document.getElementById('address-text').textContent  = d.destinationAddress || '—';
    // Description (only show if exists)
    const descEl = document.getElementById('desc-text');
    if (d.description) { descEl.textContent = '"' + d.description + '"'; }
    // Status badge
    document.getElementById('status-text').textContent = STATUS_LABELS[d.status] || d.status;
    if (FINAL.has(d.status) || CANCELLED.has(d.status)) {
      document.getElementById('badge-dot').classList.remove('pulse');
    }
  }

  function renderStepper(d, mode) {
    const cfg        = MODES[mode];
    const activeStep = getActiveStep(d.status, d.isNearby);
    const isFinal    = FINAL.has(d.status);
    const isIncident = INCIDENT.has(d.status);
    const isCancelled= CANCELLED.has(d.status);

    const html = cfg.steps.map((s, i) => {
      const n      = i + 1;
      const isDone = n < activeStep || (isFinal && n === 4);
      const isAct  = n === activeStep && !isIncident && !isCancelled;
      let cls = isDone ? 'done' : isAct ? 'active' : 'pending';
      if (isIncident && isAct) cls = 'incident';

      let timeHtml = '';
      if (n === 4 && isFinal && d.deliveredAt) {
        const dt  = new Date(d.deliveredAt);
        const str = dt.toLocaleDateString('es', {day:'numeric',month:'long'})
                  + ' · ' + dt.toLocaleTimeString('es', {hour:'2-digit',minute:'2-digit'});
        timeHtml = \`<div class="step-time">✓ \${str}</div>\`;
      }

      return \`<div class="step \${cls}">
        <div class="step-circle">\${s.icon}</div>
        <div class="step-body">
          <div class="step-title">\${s.title}</div>
          <div class="step-sub">\${s.sub}</div>
          \${timeHtml}
        </div>
      </div>\`;
    }).join('');

    document.getElementById('stepper').innerHTML = html;

    // Alert banner
    const banner = document.getElementById('alert-banner');
    if (isIncident) {
      document.getElementById('alert-icon').textContent  = '⚠️';
      document.getElementById('alert-title').textContent = cfg.incident.title;
      document.getElementById('alert-sub').textContent   = cfg.incident.sub;
      banner.classList.remove('cancelled');
      banner.classList.add('show');
    } else if (isCancelled) {
      document.getElementById('alert-icon').textContent  = '🚫';
      document.getElementById('alert-title').textContent = cfg.cancelled.title;
      document.getElementById('alert-sub').textContent   = cfg.cancelled.sub;
      banner.classList.add('cancelled','show');
    } else {
      banner.classList.remove('show');
    }

    // Live location chip
    const chip = document.getElementById('location-chip');
    if (d.lastLocation && !isFinal) {
      const t = new Date(d.lastLocation.capturedAt);
      document.getElementById('location-text').textContent =
        'Ubicación en vivo · '
        + t.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      chip.classList.add('show');
    } else {
      chip.classList.remove('show');
    }
  }

  function renderFooter() {
    if (!lastFetch) return;
    const diff = Math.round((Date.now() - lastFetch) / 1000);
    document.getElementById('last-update').textContent =
      diff < 5 ? 'ahora mismo' : 'hace ' + diff + 's';
  }

  /* ─────────────────────────────────────
     FETCH
  ───────────────────────────────────── */
  async function fetchData() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const envelope = await res.json();
      const d   = envelope.data ?? envelope;
      const mode = detectMode(d.cargoType, d.description);

      renderHeader(d, mode);
      renderStepper(d, mode);
      lastFetch = Date.now();
      renderFooter();

      if (FINAL.has(d.status) || CANCELLED.has(d.status)) {
        stopPolling();
        document.getElementById('last-update').textContent = 'Seguimiento finalizado';
      }
    } catch (e) {
      console.warn('[Tracking] error:', e.message);
    }
  }

  function stopPolling() { clearInterval(pollTimer); }

  /* ─────────────────────────────────────
     BOOT
  ───────────────────────────────────── */
  if (!TOKEN) {
    document.getElementById('page').innerHTML =
      '<div class="not-found">'
      + '<div class="not-found-icon">🔍</div>'
      + '<div class="not-found-title">Enlace inválido</div>'
      + '<div class="not-found-sub">Este enlace no existe o ha expirado.</div>'
      + '</div>';
  } else {
    fetchData();
    pollTimer = setInterval(fetchData, POLL_MS);
    setInterval(renderFooter, 5_000);
  }
</script>
</body>
</html>`;
}

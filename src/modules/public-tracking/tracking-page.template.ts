export function buildTrackingPageHtml(token: string, apiBase: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Seguimiento · Logistics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:         #f8fafc;
      --white:      #ffffff;
      --green:      #22c55e;
      --green-dk:   #16a34a;
      --green-xdk:  #166534;
      --green-lt:   #dcfce7;
      --green-xlt:  #f0fdf4;
      --border:     #e2e8f0;
      --border-dk:  #cbd5e1;
      --t1:         #0f172a;
      --t2:         #475569;
      --t3:         #94a3b8;
      --red:        #ef4444;
      --red-lt:     #fef2f2;
      --red-border: #fecaca;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--t1);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    .page { min-height: 100vh; display: flex; flex-direction: column; }

    /* ══ TOPBAR ══ */
    .topbar {
      background: #7ee8a2;
      padding: 20px 20px 22px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
      position: relative; overflow: hidden;
      z-index: 10;
    }
    .topbar::after {
      content: ''; position: absolute; right: -40px; top: -40px;
      width: 160px; height: 160px; border-radius: 50%;
      background: rgba(20,83,45,.06); pointer-events: none;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.6);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .brand-name {
      font-size: 17px; font-weight: 800;
      color: #0f172a; letter-spacing: -.4px;
    }
    .brand-sub { font-size: 12px; color: #166534; margin-top: 1px; }

    .live-chip {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600;
      padding: 5px 12px; border-radius: 99px;
      background: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.6);
      color: #14532d;
      white-space: nowrap;
    }
    .live-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--green); flex-shrink: 0;
    }
    .live-dot.pulse { animation: dotPulse 1.8s ease-in-out infinite; }
    @keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:.3} }

    /* ══ BODY ══ */
    .body {
      flex: 1;
      padding: 20px 16px 24px;
      max-width: 540px; margin: 0 auto; width: 100%;
      display: flex; flex-direction: column; gap: 14px;
      animation: fadeUp .35s ease both;
    }
    @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

    /* ══ TRACKING INFO CARD ══ */
    .info-card {
      background: var(--white);
      border-radius: 20px;
      border: 1px solid var(--border);
      overflow: hidden;
    }

    .info-card-header {
      padding: 16px 18px 14px;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: flex-start;
      justify-content: space-between; gap: 12px;
    }
    .info-label {
      font-size: 11px; font-weight: 600; letter-spacing: .1em;
      text-transform: uppercase; color: var(--t3); margin-bottom: 6px;
    }
    .tracking-number {
      font-size: 22px; font-weight: 800;
      color: var(--t1); letter-spacing: -.5px; line-height: 1.1;
    }

    .status-badge {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 700;
      padding: 6px 13px; border-radius: 99px;
      background: var(--green); color: #fff;
      white-space: nowrap; flex-shrink: 0;
    }
    .status-badge.muted { background: var(--border); color: var(--t2); }
    .status-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.7); }
    .status-badge .dot.pulse { animation: dotPulse 1.8s ease-in-out infinite; }

    .info-card-body { padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; }

    .info-row { display: flex; align-items: flex-start; gap: 10px; }
    .info-row-icon {
      width: 32px; height: 32px; border-radius: 9px;
      background: var(--bg); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 15px;
    }
    .info-row-text {}
    .info-row-label { font-size: 11px; font-weight: 600; color: var(--t3); margin-bottom: 2px; }
    .info-row-value { font-size: 15px; font-weight: 600; color: var(--t1); line-height: 1.4; }
    .info-row-sub   { font-size: 13px; color: var(--t2); font-style: italic; margin-top: 2px; line-height: 1.4; }

    .mode-tag {
      display: inline-flex; align-items: center; gap: 7px;
      font-size: 13px; font-weight: 500;
      padding: 6px 12px; border-radius: 9px;
      background: var(--bg); border: 1px solid var(--border);
      color: var(--t2); align-self: flex-start; margin-top: 2px;
    }

    /* ══ ALERT ══ */
    .alert-banner {
      display: none; align-items: flex-start; gap: 12px;
      border-radius: 14px; padding: 14px 16px;
      border: 1px solid;
    }
    .alert-banner.show { display: flex; }
    .alert-banner:not(.cancelled) { background: var(--red-lt); border-color: var(--red-border); }
    .alert-banner.cancelled       { background: var(--bg);     border-color: var(--border); }
    .alert-icon  { font-size: 22px; flex-shrink: 0; }
    .alert-title { font-size: 15px; font-weight: 700; color: var(--t1); margin-bottom: 3px; }
    .alert-sub   { font-size: 14px; color: var(--t2); line-height: 1.5; }

    /* ══ STEPPER CARD ══ */
    .stepper-card {
      background: var(--white);
      border-radius: 20px;
      border: 1px solid var(--border);
      overflow: hidden;
    }
    .stepper-card-head {
      padding: 15px 18px 13px;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    .stepper-card-title  { font-size: 15px; font-weight: 700; color: var(--t1); }
    .stepper-card-update { font-size: 12px; color: var(--t3); }

    .step { display: flex; padding: 0 18px; }

    .step-track {
      display: flex; flex-direction: column;
      align-items: center; flex-shrink: 0;
      width: 44px; padding-top: 18px;
    }
    .step-node {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0; position: relative;
      background: var(--bg); border: 2px solid var(--border-dk);
      transition: all .25s ease;
    }
    .step-icon { line-height: 1; }

    /* Done */
    .step.done .step-node { background: var(--green-lt); border-color: #86efac; }
    .step.done .step-icon { display: none; }
    .step.done .step-node::after {
      content: '';
      position: absolute;
      width: 10px; height: 7px;
      border-left: 2.5px solid var(--green-dk);
      border-bottom: 2.5px solid var(--green-dk);
      transform: rotate(-46deg);
      top: calc(50% - 4px); left: calc(50% - 4px);
    }

    /* Active */
    .step.active .step-node {
      width: 40px; height: 40px; font-size: 18px;
      background: var(--green); border-color: var(--green);
      box-shadow: 0 0 0 5px var(--green-lt);
    }
    .step.active .step-icon { filter: brightness(10); }

    /* Pending */
    .step.pending .step-node { opacity: .45; }

    /* Incident */
    .step.incident .step-node { background: var(--red-lt); border-color: var(--red-border); }

    /* Line */
    .step-line {
      width: 2px; flex: 1; min-height: 16px;
      background: var(--border); border-radius: 2px;
      margin: 4px 0; position: relative; overflow: hidden;
    }
    .step-line::after {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 0%;
      background: var(--green);
      transition: height .6s ease; border-radius: 2px;
    }
    .step.done .step-line::after { height: 100%; }

    /* Content */
    .step-content {
      flex: 1; min-width: 0;
      padding: 18px 0 18px 14px;
      border-bottom: 1px solid var(--border);
    }
    .step:last-child .step-content { border-bottom: none; }

    .step-title {
      font-size: 15px; font-weight: 600;
      color: var(--t3); line-height: 1.3; transition: color .25s;
    }
    .step.done .step-title   { color: var(--t2); }
    .step.active .step-title { font-size: 17px; font-weight: 800; color: var(--t1); }

    .step-sub {
      margin-top: 4px; font-size: 13px;
      color: var(--t3); line-height: 1.5;
    }
    .step.active .step-sub { font-size: 14px; color: var(--t2); }

    .step-chip {
      display: none;
      margin-top: 8px;
    }
    .step.active .step-chip {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600;
      padding: 4px 11px; border-radius: 99px;
      background: var(--green-lt); color: var(--green-dk);
    }
    .step-chip .dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--green);
      animation: dotPulse 1.8s ease-in-out infinite;
    }
    .step-time { margin-top: 6px; font-size: 12px; font-weight: 600; color: var(--green-dk); }

    /* ══ LOCATION CHIP ══ */
    .location-chip {
      display: none; align-items: center; gap: 9px;
      padding: 13px 16px; border-radius: 14px;
      background: var(--white); border: 1px solid var(--border);
      font-size: 14px; color: var(--green-dk); font-weight: 600;
    }
    .location-chip.show { display: flex; }
    .loc-dot {
      width: 9px; height: 9px; border-radius: 50%;
      background: var(--green); flex-shrink: 0;
      animation: dotPulse 1.8s ease-in-out infinite;
    }

    /* ══ FOOTER ══ */
    .footer {
      background: #14532d;
      border-top: none;
      padding: 14px 20px;
      margin-top: auto;
    }
    .footer-inner {
      max-width: 540px; margin: 0 auto;
      display: flex; align-items: center;
      justify-content: space-between; gap: 12px; flex-wrap: wrap;
    }
    .footer-brand { display: flex; align-items: center; gap: 9px; }
    .footer-icon {
      width: 28px; height: 28px; border-radius: 8px;
      background: rgba(255,255,255,.12);
      display: flex; align-items: center; justify-content: center;
    }
    .footer-name { font-size: 13px; font-weight: 700; color: rgba(255,255,255,.85); }
    .footer-right { display: flex; align-items: center; gap: 10px; }
    .footer-hint  { font-size: 12px; color: rgba(255,255,255,.4); }
    .footer-hint span { color: rgba(255,255,255,.7); font-weight: 500; }
    .refresh-btn {
      font-size: 12px; font-weight: 500;
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 6px 14px; border-radius: 8px;
      background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2);
      color: rgba(255,255,255,.8); cursor: pointer;
      transition: all .15s ease;
    }
    .refresh-btn:hover { background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.35); color: #fff; }

    /* ══ SKELETON ══ */
    .sk {
      display: inline-block; border-radius: 6px;
      background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.6s infinite;
    }
    @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }

    /* ══ NOT FOUND ══ */
    .not-found {
      flex: 1; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 14px; padding: 40px; text-align: center;
    }
    .not-found-icon  { font-size: 52px; }
    .not-found-title { font-size: 20px; font-weight: 700; color: var(--t1); }
    .not-found-sub   { font-size: 14px; color: var(--t2); }
  </style>
</head>
<body>
<div class="page" id="page">

  <!-- TOPBAR -->
  <header class="topbar">
    <div class="brand">
      <div class="brand-icon" id="brand-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M1 3h15v13H1V3z" stroke="#14532d" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M16 8h4l3 4v4h-7V8z" stroke="#14532d" stroke-width="1.8" stroke-linejoin="round"/>
          <circle cx="5.5" cy="18.5" r="2" stroke="#14532d" stroke-width="1.8"/>
          <circle cx="18.5" cy="18.5" r="2" stroke="#14532d" stroke-width="1.8"/>
        </svg>
      </div>
      <div>
        <div class="brand-name">Logistics</div>
        <div class="brand-sub" id="brand-tagline">Seguimiento en tiempo real</div>
      </div>
    </div>
    <div class="live-chip" id="live-chip">
      <div class="live-dot pulse" id="badge-dot"></div>
      <span id="status-text">—</span>
    </div>
  </header>

  <!-- BODY -->
  <main class="body">

    <!-- Info card -->
    <div class="info-card">
      <div class="info-card-header">
        <div>
          <div class="info-label">N° de seguimiento</div>
          <div class="tracking-number" id="tracking-code">
            <span class="sk" style="width:180px;height:22px;display:inline-block">&nbsp;</span>
          </div>
        </div>
        <div class="status-badge" id="status-badge">
          <div class="dot pulse" id="chip-dot"></div>
          <span id="chip-text">—</span>
        </div>
      </div>
      <div class="info-card-body">
        <div class="info-row">
          <div class="info-row-icon">📍</div>
          <div class="info-row-text">
            <div class="info-row-label">Destino</div>
            <div class="info-row-value" id="address-text">
              <span class="sk" style="width:200px;height:14px;display:inline-block">&nbsp;</span>
            </div>
            <div class="info-row-sub" id="desc-text"></div>
          </div>
        </div>
        <div class="mode-tag" id="mode-chip">
          <span id="mode-icon">📦</span>
          <span id="mode-label">Envío de paquete</span>
        </div>
      </div>
    </div>

    <!-- Alert -->
    <div class="alert-banner" id="alert-banner">
      <div class="alert-icon" id="alert-icon">⚠️</div>
      <div>
        <div class="alert-title" id="alert-title">Incidente</div>
        <div class="alert-sub"   id="alert-sub">El operador se comunicará contigo.</div>
      </div>
    </div>

    <!-- Stepper card -->
    <div class="stepper-card">
      <div class="stepper-card-head">
        <div class="stepper-card-title">Estado del envío</div>
        <div class="stepper-card-update" id="last-update">—</div>
      </div>
      <div id="stepper">
        ${[0, 1, 2, 3]
          .map(
            (i) => `
        <div style="display:flex;padding:0 18px">
          <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:44px;padding-top:18px">
            <span class="sk" style="width:36px;height:36px;border-radius:50%;display:block">&nbsp;</span>
            ${i < 3 ? `<div style="width:2px;flex:1;min-height:20px;background:var(--border);border-radius:2px;margin:4px 0"></div>` : ''}
          </div>
          <div style="flex:1;padding:18px 0 18px 14px;border-bottom:${i < 3 ? '1px solid var(--border)' : 'none'};display:flex;flex-direction:column;gap:8px">
            <span class="sk" style="width:42%;height:15px;display:inline-block">&nbsp;</span>
            <span class="sk" style="width:68%;height:13px;display:inline-block">&nbsp;</span>
          </div>
        </div>`,
          )
          .join('')}
      </div>
    </div>

    <!-- Live location -->
    <div class="location-chip" id="location-chip">
      <div class="loc-dot"></div>
      <span id="location-text">Ubicación en vivo activa</span>
    </div>

  </main>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M1 3h15v13H1V3z" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linejoin="round"/>
            <path d="M16 8h4l3 4v4h-7V8z" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linejoin="round"/>
            <circle cx="5.5" cy="18.5" r="2" stroke="rgba(255,255,255,.8)" stroke-width="2"/>
            <circle cx="18.5" cy="18.5" r="2" stroke="rgba(255,255,255,.8)" stroke-width="2"/>
          </svg>
        </div>
        <div class="footer-name">Logistics Software</div>
      </div>
      <div class="footer-right">
        <div class="footer-hint">Actualizado: <span id="footer-update">—</span></div>
        <button class="refresh-btn" onclick="fetchData()">↻ Actualizar</button>
      </div>
    </div>
  </footer>

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
     MODOS
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
      incident:  { title: 'Incidente en la entrega',  sub: 'El conductor reportó un problema. El equipo se comunicará contigo a la brevedad.' },
      cancelled: { title: 'Envío cancelado',           sub: 'Este envío fue cancelado. Contacta al operador para más información.' },
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
      incident:  { title: 'Incidente en el viaje',  sub: 'El conductor reportó un problema. El operador se comunicará contigo.' },
      cancelled: { title: 'Viaje cancelado',         sub: 'Este viaje fue cancelado. Contacta al operador para más información.' },
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
      incident:  { title: '⚠️ Atención — incidente reportado', sub: 'El conductor reportó una novedad. El operador se comunicará contigo de inmediato.' },
      cancelled: { title: 'Servicio cancelado',                 sub: 'Este servicio fue cancelado. Por favor comunícate con el operador.' },
    },
  };

  /* ─────────────────────────────────────
     STEP ACTIVO
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
    const cfg   = MODES[mode];
    const label = STATUS_LABELS[d.status] || d.status;
    const isFinal    = FINAL.has(d.status);
    const isCancelled= CANCELLED.has(d.status);

    document.getElementById('brand-icon').innerHTML      = cfg.brandSvg;
    document.getElementById('brand-tagline').textContent = cfg.tagline;
    document.getElementById('mode-icon').textContent     = cfg.chip.icon;
    document.getElementById('mode-label').textContent    = cfg.chip.label;
    document.getElementById('tracking-code').textContent = d.trackingCode || TOKEN.slice(0,8).toUpperCase();
    document.getElementById('address-text').textContent  = d.destinationAddress || '—';

    const descEl = document.getElementById('desc-text');
    if (d.description) descEl.textContent = '"' + d.description + '"';

    document.getElementById('status-text').textContent = label;
    document.getElementById('chip-text').textContent   = label;

    const badge  = document.getElementById('status-badge');
    const liveDot= document.getElementById('badge-dot');
    const chipDot= document.getElementById('chip-dot');

    if (isFinal || isCancelled) {
      liveDot.classList.remove('pulse');
      chipDot.classList.remove('pulse');
      if (isCancelled) badge.classList.add('muted');
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
      const isLast = i === cfg.steps.length - 1;
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

      const chip = isAct
        ? \`<div class="step-chip"><div class="dot"></div>En progreso</div>\`
        : '';

      return \`<div class="step \${cls}">
        <div class="step-track">
          <div class="step-node"><span class="step-icon">\${s.icon}</span></div>
          \${!isLast ? '<div class="step-line"></div>' : ''}
        </div>
        <div class="step-content">
          <div class="step-title">\${s.title}</div>
          <div class="step-sub">\${s.sub}</div>
          \${chip}\${timeHtml}
        </div>
      </div>\`;
    }).join('');

    document.getElementById('stepper').innerHTML = html;

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
    const txt  = diff < 5 ? 'ahora mismo' : 'hace ' + diff + 's';
    document.getElementById('footer-update').textContent  = txt;
    document.getElementById('last-update').textContent    = txt;
  }

  /* ─────────────────────────────────────
     FETCH
  ───────────────────────────────────── */
  async function fetchData() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const envelope = await res.json();
      const d    = envelope.data ?? envelope;
      const mode = detectMode(d.cargoType, d.description);
      renderHeader(d, mode);
      renderStepper(d, mode);
      lastFetch = Date.now();
      renderFooter();
      if (FINAL.has(d.status) || CANCELLED.has(d.status)) {
        stopPolling();
        document.getElementById('footer-update').textContent = 'Seguimiento finalizado';
        document.getElementById('last-update').textContent   = 'Finalizado';
      }
    } catch (e) {
      console.warn('[Tracking] error:', e.message);
      const stepper = document.getElementById('stepper');
      if (stepper && stepper.querySelector('.sk')) {
        stepper.innerHTML =
          '<div style="padding:24px 18px;text-align:center;color:#94a3b8;font-size:14px">'
          + '⚠️ No se pudo cargar la información. '
          + '<button onclick="fetchData()" style="background:none;border:none;color:#16a34a;font-weight:600;cursor:pointer;font-size:14px">Reintentar</button>'
          + '</div>';
      }
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

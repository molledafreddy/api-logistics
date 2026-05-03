#!/usr/bin/env bash
# ============================================================================
# Sprint C.4 — Smoke test del MapboxOptimizationProvider
#
# Crea un escenario listo para validar `POST /v1/delivery-runs/:id/optimize`
# con `provider=mapbox`:
#
#   1. Crea 4 shipments con coordenadas reales en Santiago (Modelo C completo:
#      origin/destination + place_id + confidence).
#   2. Crea 1 delivery_run en estado PLANNED con los 4 shipments asociados.
#   3. Imprime el RUN_ID y los curl listos para:
#        a) optimizar con Mapbox (provider=mapbox)
#        b) optimizar con Haversine (baseline para comparar)
#
# Requisitos:
#   - API corriendo en http://localhost:3000
#   - Variables: TOKEN (Supabase JWT), opcional API_URL
#   - jq instalado
#   - Usuario con rol >= DISPATCHER (necesario para POST /shipments y /delivery-runs)
#
# Uso:
#   export TOKEN="eyJhbGc..."
#   bash scripts/smoke-c4-mapbox-optimize.sh
# ============================================================================

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
TOKEN="${TOKEN:?ERROR: exporta TOKEN con un JWT Supabase válido}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq no está instalado (brew install jq)" >&2
  exit 1
fi

H_AUTH="Authorization: Bearer ${TOKEN}"
H_JSON="Content-Type: application/json"

# --- Coordenadas reales en Santiago (warehouse + 4 destinos) -----------------
# Origin warehouse:    Bandera 84, Santiago Centro
ORIGIN_LAT="-33.4378"
ORIGIN_LNG="-70.6504"
ORIGIN_ADDR="Av. Bandera 84, Santiago Centro"

# Destinos (4 puntos repartidos por Las Condes/Providencia/Centro/Costanera)
declare -a DEST_NAMES=(
  "Av. Apoquindo 4501, Las Condes"
  "Av. Providencia 1208, Providencia"
  "Costanera Center, Av. Andrés Bello 2425, Providencia"
  "Estación Central, Av. Libertador B. O'Higgins 3322"
)
declare -a DEST_LATS=( "-33.4172" "-33.4264" "-33.4173" "-33.4528" )
declare -a DEST_LNGS=( "-70.6044" "-70.6168" "-70.6068" "-70.6792" )
declare -a DEST_PLACE_IDS=(
  "smoke.c4.apoquindo"
  "smoke.c4.providencia"
  "smoke.c4.costanera"
  "smoke.c4.estacion"
)

echo "──────────────────────────────────────────────────────────────"
echo "Sprint C.4 — Mapbox Optimization smoke test"
echo "API: ${API_URL}"
echo "──────────────────────────────────────────────────────────────"

# --- 1. Crear shipments -------------------------------------------------------
SHIPMENT_IDS=()
for i in 0 1 2 3; do
  IDX=$((i + 1))
  echo
  echo "[${IDX}/4] Creando shipment → ${DEST_NAMES[$i]} ..."

  PAYLOAD=$(jq -nc \
    --arg oa "$ORIGIN_ADDR" --arg ola "$ORIGIN_LAT" --arg olg "$ORIGIN_LNG" \
    --arg da "${DEST_NAMES[$i]}" --arg dla "${DEST_LATS[$i]}" --arg dlg "${DEST_LNGS[$i]}" \
    --arg dpid "${DEST_PLACE_IDS[$i]}" \
    --arg ref "SMOKE-C4-${IDX}-$(date +%s)" \
    --arg desc "Smoke C.4 Mapbox optimize — stop ${IDX} (${DEST_NAMES[$i]})" \
    '{
      referenceNumber: $ref,
      description: $desc,
      originAddress: $oa,
      originLat: $ola,
      originLng: $olg,
      originPlaceId: "smoke.c4.bandera",
      originConfidence: "0.95",
      destinationAddress: $da,
      destinationLat: $dla,
      destinationLng: $dlg,
      destinationPlaceId: $dpid,
      destinationConfidence: "0.92",
      priority: "normal"
    }')

  RES=$(curl -sS -X POST "${API_URL}/v1/shipments" \
    -H "${H_AUTH}" -H "${H_JSON}" \
    -d "${PAYLOAD}")

  SID=$(echo "$RES" | jq -r '(.data.id // .id) // empty')
  if [[ -z "$SID" ]]; then
    echo "  ❌ Falló la creación. Respuesta:"
    echo "$RES" | jq .
    exit 1
  fi
  echo "  ✅ id=${SID}"
  SHIPMENT_IDS+=("$SID")
done

# --- 2. Crear delivery_run con los 4 shipments -------------------------------
echo
echo "Creando delivery_run con 4 shipments ..."

SHIPMENTS_JSON=$(printf '%s\n' "${SHIPMENT_IDS[@]}" | jq -R . | jq -sc .)
TODAY=$(date +%Y-%m-%d)

RUN_PAYLOAD=$(jq -nc \
  --arg name "Smoke C.4 Mapbox $(date +%H:%M:%S)" \
  --arg date "$TODAY" \
  --argjson sids "$SHIPMENTS_JSON" \
  '{
    name: $name,
    scheduledDate: $date,
    shift: "morning",
    startTime: "08:00",
    shipmentIds: $sids
  }')

RUN_RES=$(curl -sS -X POST "${API_URL}/v1/delivery-runs" \
  -H "${H_AUTH}" -H "${H_JSON}" \
  -d "${RUN_PAYLOAD}")

RUN_ID=$(echo "$RUN_RES" | jq -r '(.data.id // .id) // empty')
if [[ -z "$RUN_ID" ]]; then
  echo "❌ Falló la creación del delivery_run. Respuesta:"
  echo "$RUN_RES" | jq .
  exit 1
fi

RUN_STATUS=$(echo "$RUN_RES" | jq -r '(.data.status // .status) // "?"')
echo "✅ delivery_run id=${RUN_ID} status=${RUN_STATUS}"

# --- 3. Imprimir comandos listos ---------------------------------------------
cat <<EOF

──────────────────────────────────────────────────────────────
  Listo. RUN_ID=${RUN_ID}
──────────────────────────────────────────────────────────────

▶ Optimizar con Mapbox (provider=mapbox):

curl -sS -X POST "${API_URL}/v1/delivery-runs/${RUN_ID}/optimize" \\
  -H "Authorization: Bearer \$TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"provider":"mapbox"}' | jq .

▶ Comparar con Haversine (baseline local):

curl -sS -X POST "${API_URL}/v1/delivery-runs/${RUN_ID}/optimize" \\
  -H "Authorization: Bearer \$TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"provider":"haversine"}' | jq .

▶ Qué mirar en la respuesta de Mapbox:
  - optimizationProvider == "mapbox"
  - optimizedSequence reordenado (no es el orden de inserción)
  - estimatedDistanceKm / estimatedDurationMin con valores realistas
  - logs del API: NO debería aparecer "OPT-MB-001/002/003" salvo error
  - Si MAPBOX_TOKEN está vacío o falla la API, en logs verás el warning
    y el evento delivery_run.optimized llevará fellBackToHaversine=true

EOF

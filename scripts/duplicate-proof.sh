#!/usr/bin/env bash
#
# R2 proof: fire N identical create requests in parallel, sharing one
# Idempotency-Key, and show that exactly one order exists afterwards.
#
# Usage: pnpm proof:duplicates [request-count]

set -euo pipefail

API="${API_URL:-http://localhost:3000/api}"
EMAIL="${PROOF_EMAIL:-agent@sarh.test}"
PASSWORD="${PROOF_PASSWORD:-Agent123!}"
COUNT="${1:-2}"

JAR="$(mktemp)"
OUT="$(mktemp -d)"
trap 'rm -rf "$JAR" "$OUT"' EXIT

printf '\n\033[1mR2 — parallel duplicate-create proof\033[0m\n'
printf 'API:  %s\n' "$API"

if ! curl -sf -o /dev/null "$API/orders" -w '' 2>/dev/null; then
  : # a 401 here is expected and fine; we only want to know the API is up
fi

if ! curl -s -o /dev/null --connect-timeout 3 "$API/auth/me"; then
  printf '\033[31mAPI is not reachable at %s — run `pnpm dev` first.\033[0m\n' "$API"
  exit 1
fi

printf 'Signing in as %s… ' "$EMAIL"
LOGIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' -c "$JAR" \
  -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"

if [ "$LOGIN_CODE" != "200" ]; then
  printf '\033[31mfailed (HTTP %s). Has the database been seeded?\033[0m\n' "$LOGIN_CODE"
  exit 1
fi
printf '\033[32mok\033[0m\n'

KEY="$(uuidgen | tr '[:upper:]' '[:lower:]')"
MARKER="proof-$(date +%s)@sarh.test"

BODY=$(cat <<JSON
{
  "customerName": "Duplicate Proof",
  "customerEmail": "$MARKER",
  "items": [
    { "productName": "Wireless Keyboard", "quantity": 2, "unitPrice": 149.50 },
    { "productName": "USB-C Hub", "quantity": 1, "unitPrice": 79.99 }
  ]
}
JSON
)

printf '\nIdempotency-Key: %s\n' "$KEY"
printf 'Firing %s identical requests in parallel…\n\n' "$COUNT"

for i in $(seq 1 "$COUNT"); do
  curl -s -b "$JAR" \
    -X POST "$API/orders" \
    -H 'Content-Type: application/json' \
    -H "Idempotency-Key: $KEY" \
    -d "$BODY" \
    -w '%{http_code}' \
    -o "$OUT/body.$i" > "$OUT/code.$i" &
done
wait

CREATED=0
REPLAYED=0
for i in $(seq 1 "$COUNT"); do
  CODE="$(cat "$OUT/code.$i")"
  ID="$(sed -n 's/.*"id":"\([^"]*\)".*/\1/p' "$OUT/body.$i")"
  case "$CODE" in
    201) LABEL=$'\033[32m201 created \033[0m'; CREATED=$((CREATED + 1)) ;;
    200) LABEL=$'\033[36m200 replayed\033[0m'; REPLAYED=$((REPLAYED + 1)) ;;
    *)   LABEL=$'\033[31m'"$CODE"$' unexpected\033[0m' ;;
  esac
  printf '  request %-2s -> %s  order %s\n' "$i" "$LABEL" "$ID"
done

UNIQUE_IDS="$(cat "$OUT"/body.* | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | sort -u | wc -l | tr -d ' ')"

printf '\n  created: %s   replayed: %s   distinct order ids: %s\n\n' "$CREATED" "$REPLAYED" "$UNIQUE_IDS"

if [ "$CREATED" = "1" ] && [ "$UNIQUE_IDS" = "1" ]; then
  printf '\033[32m  PASS — %s requests, exactly one order created.\033[0m\n\n' "$COUNT"
else
  printf '\033[31m  FAIL — expected exactly one 201 and one distinct order id.\033[0m\n\n'
  exit 1
fi

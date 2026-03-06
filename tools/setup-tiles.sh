#!/usr/bin/env bash
# setup-tiles.sh — Download Japan PMTiles and upload to Cloudflare R2
#
# Prerequisites:
#   - Go-based pmtiles CLI: https://github.com/protomaps/go-pmtiles/releases
#   - Cloudflare wrangler: npx wrangler (already in devDeps)
#
# Usage:
#   bash tools/setup-tiles.sh
#
# What this does:
#   1. Creates R2 bucket "namazue-tiles" (if not exists)
#   2. Downloads latest Protomaps daily build for Japan region (~3-5GB)
#   3. Uploads japan.pmtiles to R2
#   4. Prints next steps for custom domain setup
#
# Cost: $0/mo (R2 free tier: 10GB storage, egress free)

set -euo pipefail

BUCKET_NAME="namazue-tiles"
OUTPUT_FILE="japan.pmtiles"
# Japan bounding box: 122°E-154°E, 20°N-46°N (all islands including Okinawa)
BBOX="122,20,154,46"

# ── Colors ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== Namazue Tile Setup ===${NC}"
echo ""

# ── Step 0: Check prerequisites ─────────────────────────
if ! command -v pmtiles &>/dev/null; then
  echo -e "${RED}Error: pmtiles CLI not found.${NC}"
  echo ""
  echo "Install it from: https://github.com/protomaps/go-pmtiles/releases"
  echo "  macOS:  brew install protomaps/pm/pmtiles"
  echo "  Linux:  Download binary from GitHub releases"
  echo "  Or:     go install github.com/protomaps/go-pmtiles/main@latest"
  exit 1
fi

if ! npx wrangler --version &>/dev/null; then
  echo -e "${RED}Error: wrangler not found. Run: npm install -g wrangler${NC}"
  exit 1
fi

# ── Step 1: Find latest Protomaps build ──────────────────
echo -e "${CYAN}[1/4] Finding latest Protomaps build...${NC}"

# Protomaps publishes daily builds at build.protomaps.com
# Format: YYYYMMDD.pmtiles
# We use the latest available build
LATEST_DATE=$(date -d "yesterday" +%Y%m%d 2>/dev/null || date -v-1d +%Y%m%d 2>/dev/null)
PLANET_URL="https://build.protomaps.com/${LATEST_DATE}.pmtiles"

echo "  Planet URL: ${PLANET_URL}"
echo "  Japan bbox: ${BBOX}"

# ── Step 2: Extract Japan region ─────────────────────────
echo ""
echo -e "${CYAN}[2/4] Extracting Japan region from planet build...${NC}"
echo "  This uses HTTP Range requests — no full planet download needed."
echo "  Output: ${OUTPUT_FILE} (~3-5GB)"
echo ""

if [ -f "${OUTPUT_FILE}" ]; then
  echo "  ${OUTPUT_FILE} already exists. Skipping download."
  echo "  Delete it to re-download: rm ${OUTPUT_FILE}"
else
  pmtiles extract "${PLANET_URL}" "${OUTPUT_FILE}" --bbox="${BBOX}"
  echo -e "${GREEN}  Done! $(du -h ${OUTPUT_FILE} | cut -f1) extracted.${NC}"
fi

# ── Step 3: Create R2 bucket ────────────────────────────
echo ""
echo -e "${CYAN}[3/4] Creating R2 bucket '${BUCKET_NAME}'...${NC}"

if npx wrangler r2 bucket list 2>/dev/null | grep -q "${BUCKET_NAME}"; then
  echo "  Bucket already exists."
else
  npx wrangler r2 bucket create "${BUCKET_NAME}"
  echo -e "${GREEN}  Bucket created.${NC}"
fi

# ── Step 4: Upload to R2 ────────────────────────────────
echo ""
echo -e "${CYAN}[4/4] Uploading ${OUTPUT_FILE} to R2...${NC}"
echo "  This may take a few minutes for large files."

npx wrangler r2 object put "${BUCKET_NAME}/${OUTPUT_FILE}" --file="${OUTPUT_FILE}"
echo -e "${GREEN}  Upload complete!${NC}"

# ── Next steps ──────────────────────────────────────────
echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Connect custom domain to R2 bucket:"
echo "     - Go to: https://dash.cloudflare.com → R2 → ${BUCKET_NAME} → Settings"
echo "     - Add custom domain: tiles.namazue.dev"
echo "     - Enable public access"
echo ""
echo "  2. Configure CORS (if not auto-configured):"
echo "     - R2 bucket → Settings → CORS Policy"
echo "     - Allow origin: https://namazue.dev"
echo "     - Allow methods: GET, HEAD"
echo "     - Allow headers: Range"
echo ""
echo "  3. Set env var in .env:"
echo "     VITE_PMTILES_URL=https://tiles.namazue.dev/${OUTPUT_FILE}"
echo ""
echo "  4. Build and deploy:"
echo "     npm run build && npx wrangler pages deploy dist"
echo ""
echo "Monthly cost: \$0 (R2 free tier: 10GB storage, egress free)"

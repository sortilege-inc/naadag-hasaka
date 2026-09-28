#!/usr/bin/env bash
# Naadag Hasaka's own build: the public pages and the Story Guide's seed. The books (data/) are
# upstream's, built by build/build.sh; run that first after pulling a corpus change.
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 campaign/build/build_docs.py
python3 campaign/build/build_seed.py
node --check campaign/data/docs.js
node -e "JSON.parse(require('fs').readFileSync('campaign/pack/seed.json','utf8'))"
echo "campaign/build/build.sh: OK"

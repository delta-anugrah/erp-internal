#!/usr/bin/env bash
# Checks a built erp-internal image before it is pushed: the apps, their versions against versi.json, erp_internal
# installed, Python 3.14, Node 24, the bundles Desk and the Production Floor page load, the socket.io deps, PDFs, and no credentials baked in.
# Adapted from bpt's deploy/check_image.sh.
#
#   deploy/check_image.sh ghcr.io/delta-anugrah/erp-internal:v0.1.0
set -euo pipefail

IMAGE="${1:?usage: $0 <image>}"
VERSI="$(cd "$(dirname "$0")/.." && pwd)/versi.json"
# "frappe v16.53.0 erpnext v16.52.1 hrms v16.52.0", read on the host, so the image is checked against this repo.
HARAP=$(python3 -c 'import json, sys; print(" ".join(f"{a} {t}" for a, t in json.load(open(sys.argv[1])).items()))' "$VERSI")

docker run --rm -e HARAP="$HARAP" --entrypoint bash "$IMAGE" -c '
	set -euo pipefail
	cd /home/frappe/frappe-bench
	gagal() { echo "GAGAL: $*"; exit 1; }

	# bench writes apps.txt in its own order (and the compose configurator rewrites it): compare the set.
	[ "$(sort sites/apps.txt | xargs)" = "erp_internal erpnext frappe hrms" ] || gagal "apps.txt: $(cat sites/apps.txt)"

	# Each app at its pin twice over: the git tag it was cloned from (BUILD_INFO) and its own __version__.
	set -- $HARAP
	while [ $# -gt 0 ]; do
		app=$1; tag=$2; shift 2
		grep -qx "$app $tag" BUILD_INFO || gagal "$app tag: $(cat BUILD_INFO)"
		versi=$(env/bin/python -c "import $app; print(\"v\" + $app.__version__)")
		[ "$versi" = "$tag" ] || gagal "$app __version__: $versi, versi.json $tag"
	done
	grep -q "^erp_internal " BUILD_INFO || gagal "erp_internal: $(cat BUILD_INFO)"
	env/bin/python -c "import erp_internal.setup, erp_internal.tampilan" || gagal "erp_internal not importable"
	[ -f apps/erp_internal/versi.json ] || gagal "versi.json missing from the app"

	env/bin/python --version | grep -q "^Python 3\.14\." || gagal "python: $(env/bin/python --version)"
	node -v | grep -q "^v24\." || gagal "node: $(node -v)"

	# assets/ is what the entrypoint links sites/assets to; the bundles Desk and the Production Floor page load must be there.
	env/bin/python - <<-PY || gagal "bundles"
		import json, os, sys
		peta = json.load(open("assets/assets.json"))
		for kunci in ("erp_internal.bundle.js", "lantai.bundle.js"):
		    berkas = peta.get(kunci)
		    if not berkas or not os.path.exists(berkas.replace("/assets/", "assets/", 1)):
		        sys.exit(f"{kunci}: {berkas}")
	PY

	# The websocket container runs apps/frappe/socketio.js: its npm deps must be in the image.
	(cd apps/frappe && node -e "for (const m of [\"socket.io\", \"cookie\"]) require.resolve(m)") || gagal "socketio deps"

	env/bin/python -c "import weasyprint; weasyprint.HTML(string=\"<p>x</p>\").write_pdf()" || gagal "weasyprint"

	# File names only, never the match itself: a real token must not reach the CI log.
	kena=$(grep -rlE "x-access-token:|gh[po]_[A-Za-z0-9]{20}|sk-ant-[A-Za-z0-9]" apps sites BUILD_INFO 2>/dev/null || true)
	[ -z "$kena" ] || gagal "credentials in the image? $(echo "$kena" | head -20 | tr "\n" " ")"
	echo "OK: $(tr "\n" " " < BUILD_INFO)"
'

#!/usr/bin/env bash
#
# Verifica el esquema contra un Supabase LOCAL, en Docker.
#
#     npm run verify:supabase
#
# Existe porque el adaptador de Supabase está dormido: compila, pero nadie lo
# ejecuta. Esto es lo que impide que su preludio se podrifique sin que nadie se
# entere — y lo hace sin gastar uno de los 2 proyectos activos que da el plan
# Free, que es el motivo por el que RICE(0) se mudó a Neon.
#
# Es una corrida BAJO DEMANDA, fuera del CI por defecto: necesita Docker y
# tarda minutos en el primer arranque. Lo que sí corre siempre es el typecheck,
# que es lo que garantiza que el adaptador dormido sigue encajando en el puerto.

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# La base local que levanta `supabase start`, siempre en el mismo sitio.
export SUPABASE_DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

fail() { printf '✗ %s\n' "$1" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || fail "hace falta Docker."
docker info >/dev/null 2>&1 || fail "Docker está instalado pero el daemon no responde. Arráncalo."

# `supabase start` necesita un `supabase/config.toml`. Se genera aquí y está en
# .gitignore: ese directorio es scratch de Docker, no una fuente de verdad. El
# esquema es uno y compartido (db/), y lo aplica verify-schema.mjs — deliberado,
# para que la corrida local ejercite EXACTAMENTE los mismos archivos que Neon.
if [[ ! -f supabase/config.toml ]]; then
  echo '· generando supabase/config.toml'
  npx --yes supabase@latest init --force >/dev/null 2>&1 || fail "no pude generar supabase/config.toml."
fi

STARTED_BY_US=0

cleanup() {
  if [[ "$STARTED_BY_US" == "1" ]]; then
    printf '\n· parando Supabase local\n'
    npx --yes supabase@latest stop --no-backup >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if npx --yes supabase@latest status >/dev/null 2>&1; then
  printf '· Supabase local ya estaba en marcha; se deja como estaba\n'
else
  printf '· arrancando Supabase local (la primera vez baja las imágenes)\n'
  npx --yes supabase@latest start >/dev/null || fail "no pude arrancar Supabase local."
  STARTED_BY_US=1
fi

# Preludio + migración + verificación en una transacción que se rueda atrás: la
# base local queda como estaba, así que el script es repetible.
node scripts/verify-schema.mjs supabase

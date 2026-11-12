#!/usr/bin/env bash
# Exemplo opt-in. Não agenda, não envia a nuvem e não restaura banco automaticamente.
set -euo pipefail
umask 077
if [[ "${1:-}" == "--help" ]]; then
  printf '%s\n' 'Requer pg_dump, age, sha256sum, PGSERVICE (credenciais em serviço/pgpass seguro), BOX_BACKUP_DIR absoluto fora do projeto e BOX_BACKUP_AGE_RECIPIENT (chave pública age). Gera .dump.age e checksum. Não comprova restauração.'
  exit 0
fi
: "${PGSERVICE:?Defina um serviço PostgreSQL autorizado; não coloque senha/URI na linha de comando.}"
: "${BOX_BACKUP_DIR:?Defina um destino absoluto e privado fora do projeto.}"
: "${BOX_BACKUP_AGE_RECIPIENT:?Defina a chave pública age do responsável pelo backup.}"
[[ "$BOX_BACKUP_DIR" == /* ]] || { echo 'O destino precisa ser absoluto.' >&2; exit 1; }
for tool in pg_dump age sha256sum realpath; do command -v "$tool" >/dev/null || { echo "Ferramenta ausente: $tool" >&2; exit 1; }; done
project="$(cd "$(dirname "$0")/.." && pwd -P)"
mkdir -p -- "$BOX_BACKUP_DIR"
destination="$(realpath "$BOX_BACKUP_DIR")"
[[ "$destination" != "$project" && "$destination" != "$project/"* ]] || { echo 'Não grave backups dentro do projeto.' >&2; exit 1; }
[[ ! -L "$BOX_BACKUP_DIR" ]] || { echo 'Destino simbólico não permitido.' >&2; exit 1; }
name="box-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump.age"
partial="$destination/$name.partial"
trap 'rm -f -- "$partial"' EXIT
# pipefail impede aceitar um arquivo cifrado gerado de um pg_dump que falhou.
# Sem dump aberto no disco; o segredo de descriptografia fica com o responsável, fora deste servidor.
pg_dump --dbname="service=$PGSERVICE" --format=custom --no-owner --no-acl | age --recipient "$BOX_BACKUP_AGE_RECIPIENT" > "$partial"
[[ -s "$partial" ]] || { echo 'Backup vazio; operação interrompida.' >&2; exit 1; }
mv -- "$partial" "$destination/$name"
(cd "$destination" && sha256sum -- "$name" > "$name.sha256")
printf '%s\n' 'Dump cifrado e checksum criados no destino privado. Copie para armazenamento independente e comprove restauração isolada. Nenhuma cópia externa foi feita.'

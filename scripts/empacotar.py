#!/usr/bin/env python3
"""Pacote portátil de fonte, sem dependências, builds, backups ou segredos."""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=root.parent / 'Box-Portfolio-Portatil-v1.0.zip')
args = parser.parse_args()
output = args.output.resolve()
excluded_dirs = {'.git', '.next', '.vercel', 'node_modules', 'test-results', 'playwright-report', 'coverage', 'backups', '__pycache__', '.cache', '.arena', 'artifacts'}
qa_allowed = {
    'vitest-final.json', 'playwright-final.json', 'playwright-execucao.log',
    'desempenho-laboratorio.json', 'links-e-https.json', 'instalacao-limpa.log',
    'desktop-chromium-site.png', 'desktop-chromium-painel.png',
    'desktop-chromium-cliente.png', 'desktop-chromium-painel-conteudo.png',
    'mobile-chromium-site.png', 'mobile-chromium-painel.png',
    'mobile-chromium-cliente.png', 'mobile-chromium-painel-conteudo.png'
}
entries = {}
for file in sorted(root.rglob('*')):
    rel = file.relative_to(root)
    if not file.is_file() or file.is_symlink() or any(part in excluded_dirs for part in rel.parts):
        continue
    if file == output or file.name.endswith(('.zip', '.tsbuildinfo', '.pem', '.key', '.dump')):
        continue
    if file.name.startswith('.env') and file.name != '.env.example':
        continue
    if file.name in {'id_rsa', 'id_ed25519', '.npmrc'}:
        continue
    if rel.parts[:2] == ('docs', 'qa') and file.name not in qa_allowed:
        continue
    if rel.as_posix() == 'docs/dependency-audit-inicial.json':
        continue
    if file.name.endswith('.log') and not (rel.parts[:2] == ('docs', 'qa') and file.name in qa_allowed):
        continue
    entries['projeto/' + rel.as_posix()] = file.read_bytes()
entries['COMECE-AQUI.md'] = '''# Box Experience — portfólio portátil

Abra `projeto/README.md` para a visita guiada e os guias de implantação.

- Demonstração independente e não comercial; somente dados fictícios.
- Site, landing, painel operacional, portal e conteúdo integrados.
- Instalação limpa, 155 testes locais, build e 64 testes no navegador passaram.
- Modo padrão não usa Supabase, senhas ou contas sociais reais.
- Para hospedar: Node.js 22 com processo contínuo ou Docker compatível, com proxy HTTPS.
- PHP/FTP sozinho não executa esta aplicação.
- Docker/Hostinger/Supabase remotos ainda não homologados; publicação definitiva pendente.
- Não há credenciais, banco real, dependências instaladas ou build neste ZIP.

No diretório `projeto`, com Node.js 22 instalado:

```bash
npm ci
npm run build
npm run start
```

O modo padrão de portfólio dispensa variáveis secretas. O código conectado exige ambiente dedicado e validação; consultar os limites antes de ativá-lo. Não introduzir dados pessoais reais.

As imagens e marca são propostas conceituais, não fotografias ou prova de vínculo oficial. Não houve contratação de plano pago ou publicação social.
'''.encode()
logo = root.parent / 'logo-box-3d-premium.png'
if logo.exists():
    entries['identidade/Logo-Box-Proposta.png'] = logo.read_bytes()
    entries['identidade/LEIA-ME.txt'] = 'Imagem gerada por IA e escolhida na conversa. Proposta de portfólio, não fotografia, vetor, modelo 3D ou registro de marca. Não comprova adoção oficial ou autorização comercial.\n'.encode()
manifest = '\n'.join(hashlib.sha256(data).hexdigest() + '  ' + name for name, data in sorted(entries.items())) + '\n'
entries['MANIFESTO-SHA256.txt'] = manifest.encode()
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(entries.items()):
        archive.writestr(name, data)
with zipfile.ZipFile(output) as archive:
    bad = archive.testzip()
    if bad:
        raise SystemExit('Falha de integridade: ' + bad)
    for line in archive.read('MANIFESTO-SHA256.txt').decode().splitlines():
        checksum, name = line.split('  ', 1)
        if hashlib.sha256(archive.read(name)).hexdigest() != checksum:
            raise SystemExit('Checksum inválido: ' + name)
checksum = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix(output.suffix + '.sha256').write_text(checksum + '  ' + output.name + '\n')
print(json.dumps({'arquivo': str(output), 'bytes': output.stat().st_size, 'entradas': len(entries), 'sha256': checksum, 'integridade_zip_e_manifesto': True}, ensure_ascii=False, indent=2))

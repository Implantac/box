#!/usr/bin/env python3
"""Pacote portátil de fonte, com evidências finais; sem dependências, builds ou segredos."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
release = version[:-2] if version.endswith('.0') else version
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=root.parent / f'Box-Portfolio-Portatil-v{release}.zip')
args = parser.parse_args()
output = args.output.resolve()
if output.exists():
    raise SystemExit('O pacote de destino já existe. Preserve o histórico e escolha outro --output.')

vitest = json.loads((root / f'docs/qa/vitest-v{release}.json').read_text())
playwright = json.loads((root / f'docs/qa/playwright-v{release}.json').read_text())
stats = playwright['stats']
summary = json.loads((root / f'docs/qa/resumo-v{release}.json').read_text())
if not vitest.get('success') or vitest['numFailedTests'] or vitest['numPassedTests'] != vitest['numTotalTests']:
    raise SystemExit('Testes locais ainda não estão aprovados.')
if not stats['expected'] or any(stats[key] for key in ('skipped', 'unexpected', 'flaky')):
    raise SystemExit('A bateria de navegador não está totalmente aprovada.')
if summary.get('version') != version or not summary.get('cleanInstallPassed') or not summary.get('buildPassed'):
    raise SystemExit('Resumo da versão, build ou instalação limpa não confirmado.')
if not summary.get('sourceFiles'):
    raise SystemExit('Fotografia do fonte validado não encontrada.')
for name, expected_hash in summary['sourceFiles'].items():
    source_file = root / name
    if not source_file.is_file() or hashlib.sha256(source_file.read_bytes()).hexdigest() != expected_hash:
        raise SystemExit('Fonte mudou após a validação; repetir QA antes de empacotar: ' + name)

excluded_dirs = {'.git', '.next', '.vercel', 'node_modules', 'test-results', 'playwright-report', 'coverage', 'backups', '__pycache__', '.cache', '.arena', 'artifacts', '.venv'}
qa_allowed = {
    'vitest-final.json', 'playwright-base-v1.0.json', 'playwright-execucao.log',
    'desempenho-laboratorio.json', 'links-e-https.json', 'instalacao-limpa.log',
    'playwright-vercel.json', 'playwright-vercel.log', 'vercel-smoke.json', 'vercel-https.json',
    'vitest-v1.1.json', 'vitest-v1.1.log', 'playwright-v1.1.json', 'playwright-v1.1.log',
    'build-v1.1.log', 'instalacao-limpa-v1.1.log', 'resumo-v1.1.json', 'http-smoke-v1.1.json',
    'publicacao-v1.1.json', 'playwright-deploy-v1.1.json', 'playwright-deploy-v1.1.log',
    'vercel-build-v1.1.log', 'vercel-https-v1.1.json', 'deploy-v1.1.0-smoke.json',
    f'layout-v{release}.json', f'layout-v{release}.log',
    f'layout-deploy-v{release}.json', f'layout-deploy-v{release}.log',
    f'playwright-deploy-v{release}.json', f'playwright-deploy-v{release}.log',
    f'publicacao-v{release}.json', f'vercel-https-v{release}.json', f'vercel-build-v{release}.log',
    f'deploy-v{version}-smoke.json',
    f'vitest-v{release}.json', f'vitest-v{release}.log',
    f'playwright-v{release}.json', f'playwright-v{release}.log',
    f'build-v{release}.log', f'typecheck-v{release}.log', f'instalacao-limpa-v{release}.log',
    f'resumo-v{release}.json', f'http-smoke-v{release}.json',
    f'preflight-portfolio-v{release}.json', f'preflight-connected-v{release}.json',
    f'connected-build-v{release}.json', f'connected-build-v{release}.log', f'backup-syntax-v{release}.log',
}
for profile in ('desktop-chromium', 'mobile-chromium', f'desktop-chromium-local-v{release}', f'mobile-chromium-local-v{release}', f'desktop-chromium-deploy-v{release}', f'mobile-chromium-deploy-v{release}'):
    for screen in ('site', 'painel', 'cliente', 'painel-conteudo', 'painel-estoque', 'painel-mecanicos', 'painel-comissoes', 'painel-fiscal', 'painel-ativacao', 'fiscal-documento'):
        qa_allowed.add(f'{profile}-{screen}.png')

qa_allowed.update({'publicacao-v1.1.1.json', f'estado-publicacao-v{release}.json'})

qa_allowed_paths = {f'visual-v{release}/{mode}-{screen}{suffix}.png' for mode in ('local', 'publico') for screen in ('wide','desktop','tablet','mobile') for suffix in ('','-hero')}
# Preservar as evidências históricas efetivamente ligadas pelos guias, sem incluir logs brutos.
for document in [root / 'README.md', *(root / 'docs').glob('*.md')]:
    for target in re.findall(r'\]\(([^)]+)\)', document.read_text()):
        if re.match(r'(?:https?:|mailto:|#|data:)', target):
            continue
        resolved = (document.parent / target.split('#')[0]).resolve()
        if resolved.is_relative_to(root / 'docs/qa') and resolved.suffix in {'.png', '.json'}:
            qa_allowed_paths.add(resolved.relative_to(root / 'docs/qa').as_posix())

# Padrões de credenciais reais; nomes de variáveis e exemplos não são segredos.
secret_patterns = [
    re.compile(rb'gh[pousr]_[A-Za-z0-9]{30,}'),
    re.compile(rb'github_pat_[A-Za-z0-9_]{40,}'),
    re.compile(rb'sb_secret_[A-Za-z0-9_-]{30,}'),
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
]
entries = {}
for file in sorted(root.rglob('*')):
    rel = file.relative_to(root)
    if not file.is_file() or file.is_symlink() or any(part in excluded_dirs for part in rel.parts):
        continue
    if file == output or file.name.endswith(('.zip', '.tsbuildinfo', '.pem', '.key', '.dump', '.pfx', '.p12', '.p7b', '.jks', '.keystore', '.age', '.gpg', '.sqlite', '.sqlite3', '.db')):
        continue
    if file.name.startswith('.env') and file.name != '.env.example':
        continue
    if file.name in {'id_rsa', 'id_ed25519', '.npmrc', '.netrc', '.git-credentials', '.pgpass', '.pg_service.conf'}:
        continue
    if rel.parts[:2] == ('docs', 'qa') and file.name not in qa_allowed and rel.relative_to('docs/qa').as_posix() not in qa_allowed_paths:
        continue
    if rel.as_posix() == 'docs/dependency-audit-inicial.json':
        continue
    if file.name.endswith('.log') and not (rel.parts[:2] == ('docs', 'qa') and file.name in qa_allowed):
        continue
    data = file.read_bytes()
    if any(pattern.search(data) for pattern in secret_patterns):
        raise SystemExit('Possível credencial encontrada; pacote interrompido no arquivo: ' + rel.as_posix())
    entries['projeto/' + rel.as_posix()] = data

entries['COMECE-AQUI.md'] = f'''# Box Experience — portfólio portátil {version}

Abra `projeto/README.md` e `projeto/docs/ATIVACAO-REAL.md`.

- Projeto independente e não comercial; padrão com dados fictícios isolados por sessão.
- Site, landing, gestão, portal, estoque/equipe e comissões opcionais preservados.
- Nova área de NF-e de peças e NFS-e de serviços, por OS/versão aprovada.
- Cadastros, snapshots, classificação preparatória e simulações explícitas: SEM VALIDADE FISCAL.
- Checklist operacional, pré-verificação CLI e roteiro de homologação/backup/retorno.
- Provedor não escolhido. Conector, produtor/runner, tributos e artefatos reais ainda precisam de implementação/homologação. Não basta mudar uma variável.
- Quatro migrações no fonte, testadas apenas localmente. Nenhum SQL remoto executado.
- {vitest['numPassedTests']} testes locais e {stats['expected']} testes de navegador locais (desktop/celular emulado) passaram.
- Build e instalação limpa Node.js 22 passaram. Evidências e limites em `projeto/docs/VALIDACAO-1.2.md`.
- Fonte {version} NÃO PUBLICADO nesta etapa. O site público permanece 1.1.1 e o GitHub/main 1.0.
- Nenhuma alteração em hospedagem/banco remotos, AGROTECH, planos ou integrações reais.
- Não há credenciais, dados reais, dependências instaladas ou build neste ZIP.

Com Node.js 22, no diretório `projeto`:

```bash
npm ci
npm run preflight
npm run build
npm run start
```

Abra `http://localhost:3000`, depois `/painel/fiscal` e `/painel/ativacao`.
O padrão dispensa variáveis secretas. Hospedagem exige Node 22 contínuo ou Docker compatível,
com HTTPS; PHP/FTP sozinho não executa o aplicativo. Docker/systemd/Caddy e a operação
externa ainda exigem validação no destino.

O modo conectado requer ambiente dedicado, contas individuais/MFA, quatro migrações e
homologação. Não use dados pessoais reais antes dos testes e aceite. Não envie senhas,
tokens ou certificados pelo chat. Veja `FISCAL-CONTRATO.md` e `HOMOLOGACAO-REAL-MODELO.md`.

Sessões antigas são preservadas sem criar notas/serviços/comissões retroativos.
Não há cobrança, pagamento, compra, folha, mensagem ou publicação social real.
As imagens/marca são conceituais, não fotografia, vínculo oficial ou registro de marca.
Os 46 itens do plano não foram declarados integralmente concluídos.
'''.encode()
logo = root.parent / 'logo-box-3d-premium.png'
if logo.exists():
    entries['identidade/Logo-Box-Proposta.png'] = logo.read_bytes()
    entries['identidade/LEIA-ME.txt'] = 'Imagem gerada por IA e escolhida na conversa. Proposta de portfólio, não fotografia, vetor, modelo 3D ou registro de marca. Não comprova adoção oficial ou autorização comercial.\n'.encode()
# Validar os links do conteúdo que será entregue, não somente os da árvore de trabalho.
import posixpath
for entry_name, data in entries.items():
    if not entry_name.endswith('.md'):
        continue
    for target in re.findall(r'\]\(([^)]+)\)', data.decode()):
        if re.match(r'(?:https?:|mailto:|#|data:)', target):
            continue
        expected = posixpath.normpath(posixpath.join(posixpath.dirname(entry_name), target.split('#')[0]))
        if expected not in entries:
            raise SystemExit('Link local ausente no pacote: ' + entry_name + ' → ' + target)
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
print(json.dumps({'arquivo': str(output), 'versao': version, 'bytes': output.stat().st_size, 'entradas': len(entries), 'sha256': checksum, 'integridade_zip_e_manifesto': True, 'varredura_de_prefixos_de_segredos': 'sem ocorrência; não equivale a auditoria completa'}, ensure_ascii=False, indent=2))

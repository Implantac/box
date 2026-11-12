"""Ajuste reproduzível da paleta inicial. Não é auditoria de acessibilidade."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]/'src/app'
def rgb(h):
 h=h.lstrip('#')
 if len(h)==3:h=''.join(c*2 for c in h)
 return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def lum(h):
 c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb(h)]
 return .2126*c[0]+.7152*c[1]+.0722*c[2]
def ratio(a,b):
 x,y=sorted([lum(a),lum(b)])
 return (y+.05)/(x+.05)
def fit(h,dark):
 base=h[:7] if len(h)>7 else h
 if len(base) not in (4,7):return h
 if ratio(base,'#1a211d' if dark else '#edf2e5')>=4.9:return h
 r,g,b=rgb(base)
 if dark:return '#cbb984' if r>g and g>b and r-b>.12 else '#b9c4b1'
 if r>g and g>b and r-b>.12:return '#785c26'
 if r>g+.06 and r>b+.025:return '#914d42'
 if b>r+.06 and b>g:return '#66577c'
 if b>r and g>r:return '#42667c'
 return '#526057'
for filename in ['public.css','dashboard.css','globals.css']:
 p=ROOT/filename;s=p.read_text()
 def block(m):
  selector,decls=m.group(1),m.group(2)
  if filename=='dashboard.css':
   dark=bool(re.search(r'(?:sidebar|workspace-(?:switch|label|symbol)|nav-(?:link|group|alert)|project-icon|back-to-site|social-visual|visual-(?:care|team|demo)|social-play)',selector))
   if 'workspace-promo' in selector:dark=False
  elif filename=='public.css':
   light=bool(re.search(r'(?:light-section|section-heading|service-|process-step|concept-cta|faq-|lead-form|lead-success|form-kicker|form-privacy|landing-links)',selector))
   dark=not light
  else:
   dark=bool(re.search(r'(?:brand-light|btn-dark-outline|auth-brand-panel|guide-page pre)',selector))
  # Altera apenas texto; preserva bordas e fundos.
  decls=re.sub(r'(?<![-\w])color:(#[a-fA-F0-9]{3,8})(?=[;!}]|$)',lambda n:'color:'+fit(n.group(1),dark),decls)
  if not re.search(r'brand[^,{]*small|social-visual-brand>span',selector):
   decls=re.sub(r'font-size:([\d.]+)px',lambda n:'font-size:'+str(max(11,float(n.group(1)))).removesuffix('.0')+'px',decls)
  return selector+'{'+decls+'}'
 s=re.sub(r'([^{}]+)\{([^{}]*)\}',block,s)
 # Fundos grafite no lugar do verde escuro; ilustrações preservadas.
 for color in ['101b16','101e17','132219','14231a','101b15','17251c','202c22','192b1e','101e16','14251e','15251e','1d3022','263b27','202e22','17271e']:
  vals=[int(color[i:i+2],16) for i in (0,2,4)];avg=round(sum(vals)/3)
  new=''.join(f'{v:02x}' for v in (max(0,avg-1),avg,min(255,avg+1)))
  s=s.replace('#'+color,'#'+new)
 s=s.replace('--muted:#79817b','--muted:#647066').replace('--gold-deep:#a78338','--gold-deep:#785c26')
 p.write_text(s.replace('}', '}\n'))
# Overrides finais para a ordem de importação e controles de toque.
p=ROOT/'globals.css'
p.write_text(p.read_text()+'''
/* Legibilidade e controles consistentes em diferentes tamanhos. */
.sidebar .sidebar-close,.dashboard-header .dashboard-menu{display:none}
.public-site .eyebrow,.bio-page>.eyebrow,.auth-brand-panel .eyebrow{color:#cbb278}
.public-site .light-section .eyebrow,.public-site .faq-section .eyebrow{color:#785c26}
input,select,textarea{font-size:13px}
.field>span:first-child,.field-label{font-size:12px}
.field>small,.help-tip,.muted{font-size:12px}
.btn{font-size:12px;min-height:42px}
.public-site .hero-copy>p,.public-site .experience-copy>p,.public-site .contact-grid>div>p{font-size:14px}
.public-site .section-heading>p,.public-site .service-card p,.public-site .process-step p,.public-site .faq-item>p{font-size:13px}
.public-site .public-nav a{font-size:12px}
.public-site .hero-assurances,.public-site .value-ribbon span{font-size:12px}
.public-site .hero-bottom,.public-site .hero-bottom a{font-size:10px;letter-spacing:.7px}
.dashboard-layout .nav-link{font-size:12px;min-height:42px}
.dashboard-layout .nav-group{font-size:10px}
.dashboard-layout .page-heading p{font-size:12px}
.dashboard-layout .panel-heading h2{font-size:15px}
.dashboard-layout .panel-heading p{font-size:11px}
.dashboard-layout .data-table th{font-size:10px}
.dashboard-layout .data-table td,.dashboard-layout .data-table td>b,.dashboard-layout .data-table td>a>b{font-size:12px}
.dashboard-layout .data-table td small,.dashboard-layout .order-no{font-size:10px}
.dashboard-layout .overview-table .badge{font-size:9px}
.dashboard-layout .stat-top{font-size:11px}
.dashboard-layout .stat-bottom{font-size:10px;white-space:normal}
.dashboard-layout .dashboard-main .btn{font-size:12px}
.dashboard-layout .user-profile b{font-size:11px}
.dashboard-layout .user-profile select{font-size:10px;min-height:24px;width:150px}
.dashboard-layout .user-profile{min-width:185px}
.dashboard-layout .sidebar-signature{font-size:9px}
.dashboard-layout .global-search input{font-size:12px;width:155px}
.dashboard-layout .global-search input::placeholder,.dashboard-layout .search-field input::placeholder{color:#657163}
.dashboard-layout .help-content{padding:25px;display:grid;gap:20px}
.dashboard-layout .help-content>div{display:flex;gap:14px}
.dashboard-layout .help-content b{display:block;margin-bottom:5px}
.dashboard-layout .help-content p,.dashboard-layout .help-content span{font-size:13px;line-height:1.9}
.portal-page .portal-welcome p,.portal-page .portal-items b,.portal-page .quote-terms>p{font-size:13px}
.portal-page .portal-welcome h1{color:#2c3d33}
.portal-page .portal-quote .panel-heading h2{color:#344f3c}
.form-error{font-size:13px;color:#9a4237;padding:12px;background:#fff1eb;border:1px solid #edcbbd;border-radius:7px;margin:0 0 18px}
@media(max-width:1100px){.dashboard-layout .global-search{display:none}.dashboard-layout .stat-card>strong{font-size:25px}.dashboard-layout .user-profile{min-width:165px}}
@media(max-width:760px){.sidebar .sidebar-close,.dashboard-header .dashboard-menu{display:inline-flex}.dashboard-layout .user-profile{min-width:160px}.dashboard-layout .user-profile select{width:125px;font-size:10px}.dashboard-layout .user-profile b{font-size:10px}.dashboard-layout .nav-group{font-size:10px}.dashboard-layout .stat-card>strong{font-size:23px}.dashboard-layout .stat-top{font-size:10px}.dashboard-layout .stat-bottom{font-size:10px}.public-site .hero-bottom>span{max-width:55%}}
@media(max-width:480px){input,select,textarea,.public-site .lead-form input,.public-site .lead-form select{font-size:16px}.public-site .hero h1{font-size:40px}.public-site .hero-assurances{flex-wrap:wrap;font-size:11px}.public-site .hero-bottom,.public-site .hero-bottom a,.public-site .hero-bottom>span{font-size:9px}.public-site .hero-actions .btn{font-size:12px}.dashboard-layout .user-avatar{display:none}.dashboard-layout .user-profile{min-width:125px}.dashboard-layout .stat-card{padding:14px 12px}.dashboard-layout .stat-icon{display:none}.dashboard-layout .stat-card>strong{font-size:23px}.dashboard-layout .user-profile select{font-size:10px}.portal-page .portal-demo-banner>select{font-size:13px}.portal-page .portal-demo-banner b,.portal-page .portal-demo-banner>div>span{font-size:11px}}
''')
print('Estilos refinados; executar testes de contraste no navegador.')

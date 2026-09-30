"""Offline v7 acceptance. Layout needs the separate real-browser review script."""
import json,re,subprocess
from pathlib import Path
from urllib.parse import urlsplit,unquote
from PIL import Image
from bs4 import NavigableString,Comment
from seo_common import ROOT,pages,BeautifulSoup
results=[]
def check(name, ok, detail=''):
 results.append(bool(ok));print(('PASS ' if ok else 'FAIL ')+name+(' — '+detail if detail else ''))
def doc(rel):return BeautifulSoup((ROOT/rel).read_text(),'html.parser')
def visible(soup):
 soup=BeautifulSoup(str(soup),'html.parser')
 for node in soup.select('script,style'):node.decompose()
 return soup.get_text(' ',strip=True)
def compact(s):return re.sub(r'\s+','',s)
period='2 小時線上技術導覽＋安裝後 7 天技術諮詢'
public=[p for p in ROOT.rglob('*.html') if not p.relative_to(ROOT).as_posix().startswith(('.claude/','clawland/','meeting/','puig/','v2/','workers/'))]
copy_files=public+[ROOT/'llms.txt',ROOT/'llms-full.txt',*(ROOT/'data/agent-kb').glob('*.md'),ROOT/'assets/agent-faq.generated.js',ROOT/'workers/ai-proxy/src/agent-kb.generated.js']
check('no retired service period, delivery promise or internal sales jargon',all(not re.search(r'30\s*天陪跑|陪跑\s*30\s*天|隔日到貨|CAC|方案規劃草案|複利',p.read_text()) for p in copy_files))
for rel in ['pricing/personal/index.html','pricing/index.html','full-agent/index.html','dual-agent/index.html','guides/hermes-vs-openclaw/index.html','llms.txt','llms-full.txt','data/agent-kb/07-personal.md']:
 check(rel+': approved personal support period',compact(period) in compact(visible(doc(rel)) if rel.endswith('.html') else (ROOT/rel).read_text()))
personal=doc('pricing/personal/index.html')
check('Offer description has approved support period',period in ''.join(s.get_text() for s in personal.select('script[type="application/ld+json"]')))
reviews=personal.select('.personal-review-card')
check('eight historical review names without current-plan links',len(reviews)==8 and all('購買時商品名（依截圖）' in r.select_one('.personal-review-plan').get_text() and not r.select_one('.personal-review-plan a') for r in reviews) and '現行方案參考' not in str(personal))
check('review disclaimer and discontinued VPS label', '截圖中的商品名為購買當時的版本，內容與現行方案不同，請以方案頁為準' in visible(personal) and '已停售方案' in next(r for r in reviews if 'review_09.webp' in str(r)).get_text())
check('no unrequested company-founding review disclaimer',not re.search('公司設立前|成立前|設立日期',str(personal)))
hero=doc('index.html').select_one('.hero-links')
check('personal hero CTA retained alongside two enterprise CTAs',len(hero.select('a'))==3 and hero.select_one('a[href="/pricing/personal/"]').get_text()=='個人使用，NT$6,000 起 ›')
terms={'TB FRAME','TB READINESS','TB DELIVERY','TB CONTINUITY'};missing=[]
for p,_,soup in pages():
 for term in terms:
  node=next((n for n in soup.body.descendants if isinstance(n,NavigableString) and not isinstance(n,Comment) and term in str(n) and not n.find_parent(['script','style','nav','footer'])),None)
  if node is not None and term+'（' not in str(node) and not (getattr(node.next_sibling,'get',lambda *x:[])('class',[])==['term-explanation']):missing.append(str(p.relative_to(ROOT))+': '+term)
check('first branded terminology includes immediate plain-language definition',not missing,'; '.join(missing))
check('AI advisor uses Think BIG identity', 'Hermes' not in (ROOT/'ask-ai.js').read_text() and '你是「Think BIG AI 顧問」' in (ROOT/'data/agent-kb/01-role.md').read_text())
for rel in ['harness/index.html','guides/hermes-vs-openclaw/index.html']:
 text=visible(doc(rel));check(rel+': Hermes identity corrected','Nous Research' in text and not re.search('我們養的|Think BIG 養的|定位完全不同|同一個嗎？不是|五種方案',text))
trust=visible(doc('trust/index.html').select_one('#remote-install'))
check('trust discloses screen access, customer presence and permission removal',all(x in trust for x in ['工程師','操作客戶電腦','敏感資訊','最小權限','客戶在場','移除遠端存取權限']))
for rel in ['06-governance','10-safety']:
 text=(ROOT/('data/agent-kb/'+rel+'.md')).read_text();check(rel+': no absolute data-access promise',all(x in text for x in ['/trust/#remote-install','可能看到','最小權限','客戶在場','不得宣稱「不會接觸工作資料或敏感資訊」']))
products=['full-agent','dual-agent','annual','annual-pro','annual-flagship','skill-pack','lobster','gift','print','subsidy','erp','enterprise-cloud','enterprise-local','harness']
manifest=json.loads((ROOT/'data/css-bundles.json').read_text())
for product in products:
 soup=doc(product+'/index.html');raw=str(soup)
 styles=[src for link in soup.select('link[rel=stylesheet]') for src in manifest.get(link['href'].split('?')[0],[link['href'].split('?')[0]])]
 check(product+': static shared white layout and retained URL',len(soup.select('h1'))==1 and len(soup.select('main'))==1 and '/assets/homesplit/apple.css' in styles and ('/assets/brand/product.css' in styles or 'editorial' in soup.body.get('class',[])) and not re.search('matrix-rain|matrix-canvas|gear-canvas|http-equiv="refresh"|location.replace',raw))
for rel in ['terms.html','privacy.html']:
 check(rel+': no ERP offer and correct email link',not re.search(r'ERP', (ROOT/rel).read_text()) and bool(doc(rel).select_one('a[href="mailto:AI@thinkbigtw.com"]')))
erp=doc('erp/index.html');check('ERP noindex with visible retirement and enterprise destination','noindex' in erp.select_one('meta[name=robots]')['content'] and '此服務已停止提供' in visible(erp) and bool(erp.select_one('a[href="/enterprise/"]')))
for retired,text,dest in [('openclaw-starter','此方案已更新','/pricing/personal/'),('hermes-starter','此方案已更新','/pricing/personal/'),('solo-pro','此方案已停售','/pricing/personal/')]:
 r=doc(retired+'/index.html');check(retired+': noindex and retirement notice with personal destination','noindex' in r.select_one('meta[name=robots]')['content'] and text in visible(r) and bool(r.select_one('a[href="'+dest+'"]')))
for p in (ROOT/'tbos/en').glob('*.html'):
 soup=BeautifulSoup(p.read_text(),'html.parser');check(p.name+': Chinese switch returns home and no SSH',all(a['href']=='/' for a in soup.select('a[href]') if a.get_text(strip=True)=='中文') and 'SSH' not in str(soup))
english=visible(doc('tbos/en/pricing.html'));check('English prices aligned to approved Chinese plans',all(x in english for x in ['NT$6,000','NT$12,000','NT$15,000','NT$32,000','NT$38,000','NT$30,000','NT$4,888','2-hour online technical walkthrough','7 days of technical consultation after installation']) and '40 skill combinations' not in english)
p_personal=doc('pricing/personal/index.html');p_personal_text=visible(p_personal)
check('personal page has both dual-agent variants: 共存版 NT$12,000 and NT$15,000','共存版' in p_personal_text and 'NT$12,000' in p_personal_text and 'NT$15,000' in p_personal_text)
check('協作會議室 clearly excluded from NT$12,000 on personal page','不含協作會議室' in p_personal_text and not re.search(r'NT\$12,000[^。\n]*[^不]含協作會議室',p_personal_text))
check('English link on every indexable Chinese footer',all(bool(s.select_one('#tb-footer a[href="/tbos/en/"]')) for _,_,s in pages()))
check('About email is mailto',bool(doc('about/index.html').select_one('a[href="mailto:AI@thinkbigtw.com"]')))
check('32/48 favicon and 180px touch icon',Image.open(ROOT/'favicon.ico').ico.sizes()=={(32,32),(48,48)} and Image.open(ROOT/'apple-touch-icon.png').size==(180,180))
for rel in ['contact/index.html','faq/index.html','404.html']:
 soup=doc(rel);check(rel+': static accessible page with icons',len(soup.select('main'))==1 and len(soup.select('h1'))==1 and soup.select_one('link[rel="apple-touch-icon"]') is not None and len(soup.main.get_text())>100)
check('FAQ uses readable copy without FAQPage rich-result schema','FAQPage' not in str(doc('faq/index.html')))
notfound=doc('404.html');check('404 offers enterprise, personal and guides; no cases/team/blog page',all(notfound.select_one('main a[href="'+url+'"]') for url in ['/enterprise/','/pricing/personal/','/guides/']) and all(not (ROOT/folder).exists() for folder in ['cases','team','blog']))
# Validate English, noindex, and added pages too; older v5 checks only inspect the sitemap.
errors=[]
for p in public:
 soup=BeautifulSoup(p.read_text(),'html.parser')
 for tag in soup.select('a[href],img[src],script[src],link[href]'):
  value=tag.get('href',tag.get('src',''));u=urlsplit(value)
  if u.scheme or u.netloc:continue
  target=ROOT/unquote(u.path.lstrip('/')) if u.path.startswith('/') else (p.parent/unquote(u.path) if u.path else p)
  if target.is_dir():target=target/'index.html'
  if not target.exists():errors.append(str(p.relative_to(ROOT))+': '+value);continue
  if u.fragment and target.suffix=='.html' and not BeautifulSoup(target.read_text(),'html.parser').find(id=unquote(u.fragment)):errors.append(str(p.relative_to(ROOT))+': missing # '+value)
check('public local links, images and fragment destinations exist',not errors,'; '.join(errors))
ai_agents=ROOT/'guides/ai-agents/index.html'
check('guides/ai-agents page exists',ai_agents.exists())
ai_agents_soup=BeautifulSoup(ai_agents.read_text(),'html.parser') if ai_agents.exists() else BeautifulSoup('','html.parser')
core_sentence='每一個都很好。但如果要長時間運作、又想費用可控，大模型品牌推出的 AI Agent 就不會是首選，但很適合拿來協作。'
check('guides/ai-agents core sentence present (3 occurrences)',ai_agents.read_text().count(core_sentence)>=3 if ai_agents.exists() else False)
ai_agents_title=ai_agents_soup.title.get_text() if ai_agents_soup.title else ''
brand_names_in_title=[b for b in ['Claude','ChatGPT','Gemini','Grok','Muse','Copilot','OpenClaw','Hermes'] if b in ai_agents_title]
check('guides/ai-agents title contains no brand names',not brand_names_in_title,'; '.join(brand_names_in_title) if brand_names_in_title else ai_agents_title)
print(json.dumps({'passed':sum(results),'total':len(results)},ensure_ascii=False))
raise SystemExit(0 if all(results) else 1)

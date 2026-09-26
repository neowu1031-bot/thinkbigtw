"""Measure 81 routed prompts with a supplied local Llama 3 tokenizer.json.
Requires the Python tokenizers package; never invokes a model or reads credentials.
"""
import argparse,json,subprocess
from pathlib import Path
from tokenizers import Tokenizer
p=argparse.ArgumentParser();p.add_argument('--tokenizer',required=True);args=p.parse_args()
root=Path(__file__).resolve().parents[1]
code="""
import {selectKnowledge} from './workers/ai-proxy/src/thinkbig.js';
const samples=['你好','公司介紹地址','企業開始個人','TB FRAME驗收維護','客服業務行銷財務','地端資料安全','個人價格方案續約修復','未知USB設備','諮詢聯絡摘要刪除'];
const rows=[];for(const a of samples)for(const b of samples)rows.push({query:a+' '+b,...selectKnowledge([{role:'user',content:a+' '+b}])});
console.log(JSON.stringify(rows));
"""
rows=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,text=True))
tokenizer=Tokenizer.from_file(args.tokenizer)
for row in rows:
 row['tokenizerTokens']=len(tokenizer.encode(row.pop('text')).ids)
 assert row['tokenizerTokens']<3000
print(json.dumps({'queries':len(rows),'min':min(r['tokenizerTokens'] for r in rows),'max':max(r['tokenizerTokens'] for r in rows),'results':rows},ensure_ascii=False,indent=2))

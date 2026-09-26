"""Mock REST pagination; no keys or production requests."""
import io,os,runpy,sys,unittest,json,urllib.error
from contextlib import redirect_stdout,redirect_stderr
from pathlib import Path
from unittest.mock import patch
SCRIPT=Path(__file__).with_name('pull-inquiries')
class PullTests(unittest.TestCase):
 def test_pagination_and_ack_watermark(self):
  calls=[]
  def fetch(req,timeout):
   calls.append(req.full_url)
   rows=[{'id':'a','consent_at':'2026-09-27T00:00:00+00:00','need':'測試摘要'}] if len(calls)==1 else []
   return io.StringIO(json.dumps(rows))
  out,err=io.StringIO(),io.StringIO()
  with patch.dict(os.environ,{'INQUIRY_SUPABASE_URL':'https://test.invalid','INQUIRY_SUPABASE_SERVICE_ROLE_KEY':'mock-only'}),patch.object(sys,'argv',[str(SCRIPT),'--since','2026-09-26T00:00:00Z','--until','2026-09-27T01:00:00Z','--limit','1']),patch('urllib.request.urlopen',fetch),redirect_stdout(out),redirect_stderr(err):
   runpy.run_path(str(SCRIPT),run_name='__main__')
  self.assertEqual(len(calls),2);self.assertIn('or=',calls[1]);self.assertEqual(json.loads(out.getvalue())['need'],'測試摘要');self.assertEqual(json.loads(err.getvalue())['status'],'complete');self.assertNotIn('mock-only',out.getvalue()+err.getvalue())
 def test_failure_does_not_emit_success(self):
  out,err=io.StringIO(),io.StringIO()
  with patch.dict(os.environ,{'INQUIRY_SUPABASE_URL':'https://test.invalid','INQUIRY_SUPABASE_SERVICE_ROLE_KEY':'mock-only'}),patch.object(sys,'argv',[str(SCRIPT),'--since','2026-09-26T00:00:00Z','--until','2026-09-27T01:00:00Z']),patch('urllib.request.urlopen',side_effect=urllib.error.URLError('unavailable')),redirect_stdout(out),redirect_stderr(err):
   with self.assertRaises(SystemExit) as result:runpy.run_path(str(SCRIPT),run_name='__main__')
  self.assertIn('do not advance watermark',str(result.exception));self.assertEqual(out.getvalue(),'');self.assertNotIn('complete',err.getvalue())
if __name__=='__main__':unittest.main()

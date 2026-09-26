"""Isolated regression fixtures: --check never writes, including legacy pages."""
import contextlib
import io
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch
import seo_common

SCRIPT = Path(__file__).with_name('sync-seo-graph.py')
ENTITY = (seo_common.ROOT / 'data/seo-entity.json').read_text()


class GraphTests(unittest.TestCase):
 def setUp(self):
  self.tmp = tempfile.TemporaryDirectory(prefix='homesplit-seo-')
  self.addCleanup(self.tmp.cleanup)
  self.root = Path(self.tmp.name)
  (self.root / 'data').mkdir()
  (self.root / 'data/seo-entity.json').write_text(ENTITY)
  self.boundary = '<meta name="twitter:card" content="summary_large_image">\n<script'
  for rel in ['about/index.html', 'guides/glossary/index.html', 'privacy.html', 'terms.html']:
   p = self.root / rel
   p.parent.mkdir(parents=True, exist_ok=True)
   p.write_text('<html><head><title>測試</title><meta name="twitter:card" content="summary_large_image">\n'
                '<script type="application/ld+json">{"@type":"WebPage","name":"stale"}</script>\n'
                '</head><body><h1>測試</h1><p>可見內文。</p></body></html>')
  (self.root / 'legacy.html').write_text('<meta name="robots" content="noindex">\n'
   '<script type="application/ld+json">{"@type":"Organization","name":"Think BIG old"}</script>')

 def snapshot(self):
  return {p.relative_to(self.root).as_posix(): (p.read_bytes(), p.stat().st_mtime_ns)
          for p in self.root.rglob('*') if p.is_file()}

 def run_graph(self, check=False):
  output = io.StringIO()
  with patch.object(seo_common, 'ROOT', self.root), \
       patch.object(seo_common, 'git_date', lambda *args: '2026-09-27'), \
       patch.object(sys, 'argv', [str(SCRIPT)] + (['--check'] if check else [])), \
       contextlib.redirect_stdout(output):
   try:
    runpy.run_path(str(SCRIPT), run_name='__main__')
   except SystemExit as e:
    return e.code, output.getvalue()
  return 0, output.getvalue()

 def test_check_reports_stale_pages_without_changing_bytes_or_mtimes(self):
  before = self.snapshot()
  code, output = self.run_graph(check=True)
  self.assertEqual(code, 1)
  self.assertIn('about/index.html', output)
  self.assertIn('legacy.html', output)
  self.assertEqual(before, self.snapshot())

 def test_build_is_idempotent_and_keeps_all_four_metadata_newlines(self):
  self.assertEqual(self.run_graph()[0], 0)
  before = self.snapshot()
  self.assertEqual(self.run_graph(check=True)[0], 0)
  self.assertEqual(before, self.snapshot())
  self.assertEqual(self.run_graph()[0], 0)
  self.assertEqual(before, self.snapshot())
  for rel in ['about/index.html', 'guides/glossary/index.html', 'privacy.html', 'terms.html']:
   self.assertIn(self.boundary, (self.root / rel).read_text())

 def test_check_catches_drift_in_legacy_only_path(self):
  self.run_graph()
  p = self.root / 'legacy.html'
  p.write_text(p.read_text().replace('"name": "Think BIG"', '"name": "Think BIG stale"'))
  before = self.snapshot()
  code, output = self.run_graph(check=True)
  self.assertEqual(code, 1)
  self.assertIn('legacy.html', output)
  self.assertNotIn('about/index.html', output)
  self.assertEqual(before, self.snapshot())


if __name__ == '__main__':
 unittest.main()

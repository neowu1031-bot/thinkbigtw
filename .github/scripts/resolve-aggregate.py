#!/usr/bin/env python3
"""
Resolve aggregate-file conflicts during publish branch rebase.

During a rebase conflict the three stages in the index are:
  :1:  ancestor (parent of the branch commit being replayed)
  :2:  ours (current HEAD, i.e. accumulated main)
  :3:  theirs (the branch commit's version of the file)

Resolution rule:
  Take :2: (ours / main) as the authoritative base.
  Extract content from :3: (theirs) whose identifying key is NOT already in :2:.
  Append / insert those new pieces into ours.

Supported files:
  sitemap.xml, sitemap-qa.xml  ->  deduplicate <url> blocks by <loc>
  llms-full.txt, llms.txt      ->  deduplicate URL sections by "URL: <url>" line
  en/qa/index.html, library/qa/index.html,
  en/news/index.html, library/news/index.html
                               ->  deduplicate article/issue blocks by href
"""
import re
import subprocess
import sys
import os

AGGREGATE_FILES = {
    'sitemap.xml', 'sitemap-qa.xml',
    'llms-full.txt', 'llms.txt',
    'en/qa/index.html', 'library/qa/index.html',
    'en/news/index.html', 'library/news/index.html',
}


def git_show_staged(stage: int, path: str) -> str | None:
    """Return file content from git staging area stage 1/2/3, or None if absent."""
    r = subprocess.run(
        ['git', 'show', f':{stage}:{path}'],
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
    )
    return r.stdout if r.returncode == 0 else None


def get_conflict_files() -> list[str]:
    """Return paths that have unmerged (conflict) status."""
    r = subprocess.run(
        ['git', 'ls-files', '-u', '--format=%(path)'],
        capture_output=True,
        text=True,
    )
    seen: set[str] = set()
    result: list[str] = []
    for line in r.stdout.splitlines():
        p = line.strip()
        if p and p not in seen:
            seen.add(p)
            result.append(p)
    return result


# ---------------------------------------------------------------------------
# Resolvers
# ---------------------------------------------------------------------------

def resolve_sitemap(ours: str, theirs: str) -> str:
    """Keep ours; add <url> blocks from theirs whose <loc> is not in ours."""
    ours_locs = set(re.findall(r'<loc>(.*?)</loc>', ours))

    new_lines: list[str] = []
    for url_block in re.findall(r'<url>.*?</url>', theirs, re.DOTALL):
        loc_m = re.search(r'<loc>(.*?)</loc>', url_block)
        if loc_m and loc_m.group(1) not in ours_locs:
            block = url_block.strip()
            if not block.startswith('  '):
                block = '  ' + block
            new_lines.append(block)

    if not new_lines:
        return ours

    insert = '\n'.join(new_lines) + '\n'
    if '</urlset>' in ours:
        return ours.replace('</urlset>', insert + '</urlset>', 1)
    if '</sitemapindex>' in ours:
        return ours.replace('</sitemapindex>', insert + '</sitemapindex>', 1)
    return ours + insert


def resolve_llms(ours: str, theirs: str) -> str:
    """Keep ours; append URL sections from theirs whose URL line is not in ours.

    Note: only llms-full.txt uses the URL: per-entry format.
    llms.txt is plain markdown and is handled by git auto-merge (never conflicts
    in practice); this function is a safe no-op for it.
    """
    ours_urls = set(re.findall(r'^URL: (.+)$', ours, re.MULTILINE))

    raw_sections = re.split(r'\n\n(?=URL: )', '\n\n' + theirs.lstrip('\n'))
    new_sections: list[str] = []
    for sec in raw_sections:
        sec = sec.strip()
        if not sec:
            continue
        url_m = re.match(r'URL: (.+)', sec)
        if url_m and url_m.group(1).strip() not in ours_urls:
            new_sections.append(sec)

    if not new_sections:
        return ours

    return ours.rstrip('\n') + '\n\n' + '\n\n'.join(new_sections) + '\n'


def resolve_html_index(ours: str, theirs: str) -> str:
    """Keep ours; insert article/issue blocks from theirs whose href is not in ours."""
    ours_hrefs = set(re.findall(
        r'href="(/(?:library|en)/(?:qa|news)/[^/"]+/?)"', ours))

    new_blocks: list[str] = []

    # QA article blocks: <article class="qa" ...> ... </article>
    for block in re.findall(r'<article\b[^>]*>.*?</article>', theirs, re.DOTALL):
        href_m = re.search(
            r'href="(/(?:library|en)/(?:qa|news)/[^/"]+/?)"', block)
        if href_m and href_m.group(1) not in ours_hrefs:
            new_blocks.append(block.strip())

    # NEWS issue blocks: <a class="issue" ...> ... </a>
    for block in re.findall(r'<a\s+class="issue".*?</a>', theirs, re.DOTALL):
        href_m = re.search(
            r'href="(/(?:library|en)/(?:qa|news)/[^/"]+/?)"', block)
        if href_m and href_m.group(1) not in ours_hrefs:
            new_blocks.append(block.strip())

    if not new_blocks:
        return ours

    new_content = '\n' + '\n'.join(new_blocks) + '\n'

    # Find insertion point after the opening of the list container
    for marker in (
        '<div class="cards">',        # en/qa/index.html, library/qa/index.html
        '<nav class="issue-list">',   # library/news/index.html
        '<div class="issue-list">',   # en/news/index.html
        '<div id="qa-list">',
        '<div class="qa-list">',
        '<section class="qa-list">',
        '<ul class="issue-list">',
    ):
        if marker in ours:
            return ours.replace(marker, marker + new_content, 1)

    # Fallback: insert before first <article or <a class="issue"
    for pat in (r'<article\b', r'<a class="issue"'):
        m = re.search(pat, ours)
        if m:
            idx = m.start()
            return ours[:idx] + new_content.lstrip('\n') + '\n' + ours[idx:]

    return ours.rstrip('\n') + new_content


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    conflicts = get_conflict_files()
    if not conflicts:
        print("resolve-aggregate: no conflicts found", file=sys.stderr)
        return 0

    non_agg = [f for f in conflicts if f not in AGGREGATE_FILES]
    if non_agg:
        print(f"ERROR: non-aggregate files in conflict: {non_agg}", file=sys.stderr)
        return 1

    resolved: list[str] = []
    for path in conflicts:
        ours   = git_show_staged(2, path)
        theirs = git_show_staged(3, path)

        if ours is None and theirs is not None:
            content = theirs
        elif ours is not None and theirs is None:
            content = ours
        elif ours is None and theirs is None:
            print(f"WARN: {path} has no stage 2 or 3", file=sys.stderr)
            continue
        else:
            if path in ('sitemap.xml', 'sitemap-qa.xml'):
                content = resolve_sitemap(ours, theirs)
            elif path in ('llms-full.txt', 'llms.txt'):
                content = resolve_llms(ours, theirs)
            else:
                content = resolve_html_index(ours, theirs)

        os.makedirs(os.path.dirname(path) if os.path.dirname(path) else '.', exist_ok=True)
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(content)
        resolved.append(path)
        print(f"  resolved: {path}")

    if resolved:
        subprocess.run(['git', 'add', '--'] + resolved, check=True)
        print(f"resolve-aggregate: staged {len(resolved)} files")

    return 0


if __name__ == '__main__':
    sys.exit(main())

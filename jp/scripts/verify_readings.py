#!/usr/bin/env python3
"""用 pykakasi 独立核对 词条读音 / 例句读音（pip install pykakasi）。
pykakasi 不是完美的（助词は→わ、个别汉字多读音），所以只报告「不一致」供人工复核。"""
import json, re, sys
import pykakasi
kks = pykakasi.kakasi()
def hira(s):
    s = s.replace('〜', '')
    out = ''.join(x['hira'] for x in kks.convert(s))
    return out
def kata2hira(s): return ''.join(chr(ord(c)-0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)
def norm(s): return kata2hira(re.sub(r'[、。！？「」\s〜]', '', s))
lib = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'jp/public/content/library.json', encoding='utf-8'))
bad = 0
for w in lib['words']:
    if w['kind'] != 'word': continue
    a, b = norm(hira(w['jp'])), norm(w['reading'])
    if a != b: print(f"词  {w['jp']}: 我写 {w['reading']} / pykakasi {a}"); bad += 1
    a, b = norm(hira(w['exJp'])), norm(w['exReading'])
    # 助词：は→わ、へ→え、を→お 在 pykakasi 里会变，统一还原比较
    a2 = a.replace('わ', 'は'); b2 = b.replace('わ', 'は')
    if a != b and a2 != b2:
        print(f"例  {w['exJp']}\n    我写 {w['exReading']}\n    kks  {a}"); bad += 1
print('不一致', bad)

#!/usr/bin/env python3
"""为 public/content/library.json 中的每个词生成泰语 MP3（public/audio/<词ID>.mp3）。
- 已存在的文件一律跳过（历史音频永不覆盖；加 --force 才重做）。
- 引擎：Microsoft Edge 神经网络泰语语音（edge-tts，默认 th-TH-PremwadeeNeural 女声，可用 --voice 换 th-TH-NiwatNeural 男声）。
- 失败不会写出空文件；最终输出失败清单，存在失败时退出码为 1（--allow-fail 则为 0）。
用法：pip install edge-tts && python3 scripts/gen_audio.py
"""
import argparse, asyncio, json, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('--library', default='public/content/library.json')
ap.add_argument('--out', default='public/audio')
ap.add_argument('--voice', default='th-TH-PremwadeeNeural')
ap.add_argument('--rate', default='-10%', help='语速，略慢更适合初学者')
ap.add_argument('--force', action='store_true')
ap.add_argument('--allow-fail', action='store_true')
a = ap.parse_args()

try:
    import edge_tts
except ImportError:
    sys.exit('请先安装：pip install edge-tts')

words = json.load(open(a.library, encoding='utf-8'))['words']
os.makedirs(a.out, exist_ok=True)
todo = [w for w in words if a.force or not os.path.exists(f"{a.out}/{w['id']}.mp3")]
print(f"共 {len(words)} 词，需生成 {len(todo)} 个")
failed = []

async def one(w, sem):
    path = f"{a.out}/{w['id']}.mp3"
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(w['thai'], a.voice, rate=a.rate).save(path + '.tmp')
                if os.path.getsize(path + '.tmp') < 1000:
                    raise RuntimeError('音频过小')
                os.replace(path + '.tmp', path)
                print('✓', w['id'], w['thai']); return
            except Exception as e:
                if os.path.exists(path + '.tmp'): os.remove(path + '.tmp')
                err = e
                await asyncio.sleep(2 ** attempt)
        print('✗', w['id'], w['thai'], err); failed.append(w)

async def main():
    sem = asyncio.Semaphore(4)
    await asyncio.gather(*(one(w, sem) for w in todo))

asyncio.run(main())
if failed:
    print(f"失败 {len(failed)} 个：", ' '.join(w['thai'] for w in failed))
    sys.exit(0 if a.allow_fail else 1)
print('完成')

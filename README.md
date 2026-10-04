# 泰语每日30词 (Thai 30)

面向中文母语者的泰语抽认卡 PWA。React + TypeScript + Vite，数据存本机 IndexedDB，离线可用，可添加到 iPhone 主屏幕。

## 开发

```bash
npm install
npm run dev            # 本地开发
npm run check:data     # 校验内置词库：泰文字符、拼音声调符号 ↔ 声调标注、60 条课程记录、初始熟练度
npm run build          # 类型检查 + 构建（BASE=/子路径/ 用于子路径部署）
npm run test:e2e       # 需先 build；Playwright iPhone 视口端到端测试
```

## 部署（HTTPS）

### A. GitHub Pages（仓库已内置流水线，推荐）
1. 仓库 **Settings → Pages → Build and deployment → Source 选 "GitHub Actions"**（只需做一次）。
2. 推送到 `main`（或在 Actions 页手动 Run workflow）。流水线会：校验数据 → 生成缺失的泰语音频 → 构建 → 部署。
3. 网址：`https://<用户名>.github.io/<仓库名>/`

### B. Vercel
导入仓库即可（`vercel.json` 已配置）。无需设置 BASE。音频需先在本机或 CI 生成并提交到 `public/audio/`。

## 发音音频

- 每个词的音频文件为 `public/audio/<词汇ID>.mp3`，与词汇 ID 永久绑定。
- 由 `scripts/gen_audio.py` 用 Microsoft 神经网络泰语语音（`edge-tts`，默认 `th-TH-PremwadeeNeural`）生成；**已存在的文件不会覆盖**。
- 本地生成：`pip install edge-tts gTTS && npm run audio`（需要能访问微软语音服务）。CI 中自动执行并把新增 mp3 提交回仓库。
- 应用播放：正常 / 0.8 倍速；Service Worker 首次播放后缓存；「我的」页可一键下载全部音频供离线。
- 文件缺失、离线、被阻止播放时都会有明确提示 + 重试；可选「系统语音」备用，并明确标注为非存档音频。
- **请抽听生成的音频**：TTS 对单个词的声调/长短音大体可靠，但无法保证 100%，发现问题可替换对应的 mp3（文件名不变）或用 `--force` 重生成。

## 每日 30 词维护

在 `content/` 新增 `day-003.csv`（UTF-8；列 `day,thai,roman,zh,theme,exTh,exRoman,exZh`；见 `content/day-003.csv.example`），推送到 main：
流水线校验（泰文字符、拼音声调、必填）→ 只为新词生成音频 → 部署。用户在线打开应用时自动**合并**新增课程，不会改动已有词条和学习记录。
泰文相同的词复用原词汇 ID（共用熟练度和音频）。也可在 App「我的 → 添加/导入课程」粘贴 CSV/JSON，带预览、校验、重复检测、可逐行修改（仅保存在本机）。

## 数据与备份

- 学习进度、词库、复习日志全部在 IndexedDB（数据库版本只做增量升级，不清空）。
- 「我的 → 导出 JSON 备份」；「从备份恢复」可选合并（进度取较新者）或覆盖。
- 内置种子只在首次运行写入初始熟练度；之后版本升级只补充缺失词条，不触碰已有进度。

## 复习算法

陌生：当天再出现（最多重排 2 次），次日优先；不熟悉 1 天；熟悉 3 天；精通 7 → 14 → 30 → 60 天。降级则重置间隔并记一次遗忘。
每日 30 词 = 到期复习（陌生/不熟悉优先，上限 15）+ 新词；新词不足则补复习。

## 未实现

账号登录与云端跨设备同步（当前用 JSON 备份迁移）；AI 自动生成词汇（已有导入校验/审核流程可对接）。

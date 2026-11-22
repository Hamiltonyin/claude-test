# 泰语每日30词（thai30）— 给 AI 助手的项目说明

面向中文母语者的泰语学习 PWA。使用者住在泰国，日常要和快递员、房东等人沟通；在 iPhone Safari 上使用（添加到主屏幕）。
线上地址：https://hamiltonyin.github.io/claude-test/ （**公开网站**）。同仓库还有一个「职场日语」App 在 `jp/`，部署到 `/jp/` 子路径。

## 和使用者协作

- 使用者用中文交流，不看代码。回复用中文，说清楚「改了什么、在哪里能看到、哪些没验证」。
- 请求常常很短。指的是哪个页面不清楚时，先截图看现状再判断；实在无法判断再问。
- 使用者上传的视频是第三方创作者的内容：**只读取字幕做成学习内容，绝不把视频文件提交进仓库**。视频由使用者在 App 里导入，只存在本机。
- 我没有语音识别：泰文、读音、时间轴都来自视频字幕和规则推导。交付时要说明这一点和大致误差。
- 直接提交并推送到 `main`（推送即部署）。提交前跑测试。

## 技术栈与结构

React 19 + TypeScript + Vite + vite-plugin-pwa。数据全部在浏览器 IndexedDB，没有后端。

```
content/            学习内容的「源文件」（人工维护）
scripts/            build-content.mjs（校验+生成 public/content/*.json）、gen_audio.py（生成 mp3）、run-e2e.mjs（跑测试）
public/content/     由 build-content.mjs 生成，不要手改
public/audio/       由 CI 生成并提交回仓库的 mp3（5000+ 个），不要手改、不要删
src/store.tsx       全局状态（词库、进度、会话、设置）与 IndexedDB 读写
src/views/          各页面；src/ui.tsx 是共用组件；src/styles.css 是全部样式
e2e/*.mjs           Playwright 端到端测试（iPhone 14 视口）
jp/                 日语 App（独立的 vite 配置）
```

### 内容文件（`content/`）

| 文件 | 格式 |
|---|---|
| `day-NNN.csv` | `day,thai,roman,zh,theme,exTh,exRoman,exZh`（带 BOM）。`theme` 为 `句式` 的行是「句子卡片」 |
| `categories.json` | 学习页的分类；`groups[].cats[].words` 是泰文列表 |
| `dialogues/*.txt` | 首行 `# id\|标题\|场景\|emoji`，`== 小节`，每行 `说话人\|泰文\|拼音\|中文`，可选第 5 段视频起止秒 `1.2-3.4` |
| `lyrics/*.txt` | 首行 `# id\|标题\|简介\|emoji`，每行 `泰文\|拼音（用 ｜ 分词组）\|中文`，可选第 4 段起止秒 |
| `sentence-notes.txt` | 句子的逐词解释：`句子\|词/拼音=释义+词/拼音=释义\|为什么这样说`，拼起来必须等于原句 |
| `parts.txt` `roots.txt` `mnemonics.txt` | 词语拆解、构词规律、记忆法 |
| `patterns.json` `classifiers.json` `verbs.json` `vowels.json` `tones.json` | 常用句式、量词、动词图集、元音、声调 |
| `tts-overrides.txt` | 个别词的 TTS 读法修正 |

改完内容必须跑 `node scripts/build-content.mjs`，它会校验并报出 `✗` 错误。

### 约定

- **拼音**：带声调符号的写法（`mâi dâi`、`khráp`、`ɯ ɔ ə ɛ`），和已有内容保持一致，不用视频里的中文拼音式写法。
- **句子 vs 单词**：`src/lib/sentences.ts` 的 `isSentence()` 在运行时区分。句子不进每日新词、复习、单词统计，有自己的入口和统计。
- **已有用户数据不改写**：`mergeLibrary` 只新增词，不修改用户已有的词。要改变分类用运行时判断，不要改旧词的字段。
- **音频**：`public/audio/<id>.mp3`，已存在的永不覆盖（除非 `tts-overrides.txt` 变了）。新内容的音频在下一次部署时由 CI 生成，在那之前 App 用系统语音兜底。
- **iOS 限制**：`play()` 必须在点击回调里同步调用；本地视频以 Blob 存 IndexedDB；不用视频自带的 `controls`（会盖住画面），用 `ui.tsx` 的 `VideoBar`。
- **IndexedDB `meta` 键**：`settings` `flips` `plays` `daily` `parked` `vowelClips` `toneClips`，以及按内容 id 的 `dlgvideo:` `dlgclips:` `dlgedit:` `lyrvideo:` `lyrclips:` `lyredit:` `patrec:`。新增「用户校准/修改」类的键时，同步加进 `src/lib/clipsBackup.ts`。
- **情景对话和歌词共用一套界面**：`src/views/Dialogues.tsx`（`kind` 为 `dlg` 或 `lyr`），`Lyrics.tsx` 只是薄包装。改一处两边都变。
- **拼音 ↔ 元音**：`src/lib/vowelLookup.ts` 把一个拼音音节（如 lɛ́ɛo）对到元音卡片或「元音 + 尾音」组合；歌词/对话滚轴中间那句的拼音可以点（`TapRoman`），元音页有搜索框。新增拼音写法时要保证它能在这里查到。
- **3D 人体**：`src/views/Body3D.tsx` 用 three.js 的基本几何体拼成（没有外部模型文件），懒加载；每个网格的 `userData.key` 是对应的泰文词。加部位就在 `buildBody()` 里加一个网格，并在 `Pictures.tsx` 的 `PARTS3D` 里加词条。
- **界面风格**：iOS 毛玻璃。屏幕上只留学习内容，其余功能收成小圆点（`.gdot`）或收进 ⚙ 设置，说明文字尽量不要。

## 命令

```bash
npm run dev                      # 本地开发
node scripts/build-content.mjs   # 校验内容并生成 public/content
npx tsc --noEmit                 # 类型检查
npm run build:all                # 构建泰语 + 日语（测试前必须先构建，不带 BASE）
npm run test:e2e                 # 并行跑全部 e2e；只跑部分：node scripts/run-e2e.mjs wheel dialogue
```

## 测试

- 改了界面或逻辑：先 `npm run build:all`，再跑相关测试；提交前跑一次全量。
- 测试以**退出码**判定成败。不要只数 `✓`/`✗` 的个数——有的测试失败时打印的是 `FAIL`。
- 新功能要配一个 `e2e/<name>.mjs`。端口用 `Number(process.env.E2E_PORT) || <随机>`，浏览器用 `chromium.launch()`（不要写死路径）。
- 需要视频的测试用 ffmpeg 现场生成测试视频，不要提交视频文件。
- 对话/歌词的测试默认界面是滚轴且图标隐藏；要测列表或图标，用 `addInitScript` 预设 `thai30-<dlg|lyr>-mode` / `-act`。

## 部署

推送到 `main` 触发 `.github/workflows/deploy.yml`：校验内容 → 跑 e2e（失败则不部署）→ 生成缺失音频并提交回仓库（`[skip ci]`）→ 构建 → 发布到 GitHub Pages。
因为 CI 会往 `main` 提交音频，本地推送前先 `git pull --rebase origin main`。

# 职场日语 · 从假名开始（jp/）

与「泰语每日30词」同仓库、同站点的独立 PWA：`https://<用户名>.github.io/<仓库名>/jp/`。学习数据（IndexedDB `nihongo`）、Service Worker（作用域 `/jp/`）、图标都与泰语 App 互相独立。

## 课程（共 28 天，397 张卡片）
- 第 1~8 天 平假名：清音 46 → 浊音/半浊音 25 → 拗音 33 → 促音「っ」
- 第 9~16 天 片假名：同上 + 长音「ー」
- 第 17~28 天 职场词汇（187 词）：问候礼貌、自我介绍、数字金额、时间日期、办公室、工作动作、会议日程、邮件电话、职位人物、商务金额、敬语句型、通勤日常

每张假名卡含：读音（罗马音）、汉字来源（如 あ←安）、例词；词汇卡含：假名读音、罗马音、中文、例句 + 例句读音。

## 开发
```bash
npm run dev:jp                 # 本地开发
node jp/scripts/build-jp.mjs   # 重新生成 library.json（假名表 + jp/content/src/words.txt），带强校验
python3 jp/scripts/verify_readings.py   # 用 pykakasi 独立核对读音（pip install pykakasi）
npm run build:all              # 构建泰语 + 日语（日语输出到 dist/jp）
npm run audio:jp               # 本地生成音频（需 pip install edge-tts gTTS）
```

## 增加词汇
编辑 `jp/content/src/words.txt`，每天一个 `# day N 标题` 段落，每行：
`日文|读音（假名）|中文|主题|例句|例句读音（假名）|例句中文|备注(可空)|罗马音覆盖(可空)`
罗马音由读音自动生成；读音必须是纯假名，不得与已有卡片重复。推送到 main 后流水线自动校验、生成缺失音频并部署，应用在线打开时自动合并新课程（只增不改，不影响学习进度）。

## 音频
`jp/public/audio/<卡片ID>.mp3`，由 edge-tts（`ja-JP-NanamiNeural`）生成，失败自动改用 gTTS；已有文件不覆盖。**单个假名的发音请抽听**（TTS 对孤立假名可能不如整词自然）。

## 与泰语 App 并存的注意点
泰语 App 的 Service Worker 作用域是 `/`，包含 `/jp/`。为避免互相干扰：泰语 SW 的 `navigateFallbackDenylist` 排除 `/jp/`，并关闭了 `cleanupOutdatedCaches`（它会按作用域前缀误删日语 App 的离线缓存）。

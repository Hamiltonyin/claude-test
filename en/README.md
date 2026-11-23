# 进阶英语 · 每日一课（en/）

与「泰语每日30词」「职场日语」同仓库、同站点的独立 PWA：`https://<用户名>.github.io/<仓库名>/en/`。
学习数据（IndexedDB `english`）、Service Worker（作用域 `/en/`）、图标都独立。代码从 `jp/` 复制改来（去掉了五十音页）。

## 增加词汇
编辑 `en/content/words.txt`，每天一个 `# day N 标题` 段落，每行：
`英文|音标(/…/，短语可空)|中文|主题|例句|例句中文|备注(可空)`
`node en/scripts/build-en.mjs` 校验（音标格式、重复、缺字段）并生成 library.json。推送后 CI 用 edge-tts `en-US-JennyNeural` 生成缺失音频（`en/public/audio/<id>.mp3`）。

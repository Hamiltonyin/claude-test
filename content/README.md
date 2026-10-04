# 每日课程内容

每天新增一个 CSV 文件，例如 `day-003.csv`（UTF-8，列：`day,thai,roman,zh,theme,exTh,exRoman,exZh`），推送到 main 后：

1. 流水线校验泰文/声调、合并到 `public/content/library.json`；
2. 只为**新词**生成音频（已有音频不会重做）；
3. 重新部署。用户设备在线打开应用时自动合并新增课程，**不会改动已有词条与学习记录**。

已存在的词（泰文相同）会复用原来的词汇 ID 和熟练度，只是归入当天课程。

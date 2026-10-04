// 内置课程数据：52 个去重词条 + 第1/2天共 60 条课程记录。
// tn：每个音节的声调（M中 L低 F降 H高 R升），独立于拼音声调符号，用于自动交叉校验（npm run check:data）。
export interface SeedWord {
  id: string; thai: string; roman: string; tn: string; zh: string; theme: string
  exTh: string; exRoman: string; exZh: string
}

export const SEED_WORDS: SeedWord[] = [
  { id: 'w001', thai: 'สวัสดี', roman: 'sà-wàt-dii', tn: 'LLM', zh: '你好；再见（问候语）', theme: '日常交流', exTh: 'สวัสดีครับ', exRoman: 'sà-wàt-dii khráp', exZh: '你好（男士说）' },
  { id: 'w002', thai: 'ขอบคุณ', roman: 'khɔ̀ɔp-khun', tn: 'LM', zh: '谢谢', theme: '日常交流', exTh: 'ขอบคุณมากค่ะ', exRoman: 'khɔ̀ɔp-khun mâak khâ', exZh: '非常感谢（女士说）' },
  { id: 'w003', thai: 'ขอโทษ', roman: 'khɔ̌ɔ-thôot', tn: 'RF', zh: '对不起；不好意思', theme: '日常交流', exTh: 'ขอโทษครับ ผมมาสาย', exRoman: 'khɔ̌ɔ-thôot khráp phǒm maa sǎai', exZh: '对不起，我来晚了。' },
  { id: 'w004', thai: 'ใช่', roman: 'châi', tn: 'F', zh: '是；对', theme: '日常交流', exTh: 'ใช่ ผมเป็นคนจีน', exRoman: 'châi phǒm pen khon jiin', exZh: '对，我是中国人。' },
  { id: 'w005', thai: 'ไม่', roman: 'mâi', tn: 'F', zh: '不；没', theme: '日常交流', exTh: 'ผมไม่กินเผ็ด', exRoman: 'phǒm mâi kin phèt', exZh: '我不吃辣。' },
  { id: 'w006', thai: 'มี', roman: 'mii', tn: 'M', zh: '有', theme: '日常交流', exTh: 'คุณมีน้ำไหม', exRoman: 'khun mii náam mǎi', exZh: '你有水吗？' },
  { id: 'w007', thai: 'ไม่มี', roman: 'mâi-mii', tn: 'FM', zh: '没有', theme: '日常交流', exTh: 'ไม่มีเงิน', exRoman: 'mâi mii ngəən', exZh: '没有钱。' },
  { id: 'w008', thai: 'เอา', roman: 'ao', tn: 'M', zh: '要；拿', theme: '点餐', exTh: 'เอาน้ำหนึ่งแก้ว', exRoman: 'ao náam nɯ̀ng kɛ̂ɛo', exZh: '要一杯水。' },
  { id: 'w009', thai: 'ได้', roman: 'dâi', tn: 'F', zh: '可以；能；得到', theme: '日常交流', exTh: 'ได้ค่ะ', exRoman: 'dâi khâ', exZh: '可以。（女士说）' },
  { id: 'w010', thai: 'ช่วย', roman: 'chûai', tn: 'F', zh: '帮忙；请（帮我…）', theme: '日常交流', exTh: 'ช่วยด้วย', exRoman: 'chûai dûai', exZh: '请帮帮我！／救命！' },
  { id: 'w011', thai: 'ไป', roman: 'pai', tn: 'M', zh: '去', theme: '打车', exTh: 'ผมจะไปร้านอาหาร', exRoman: 'phǒm jà pai ráan aa-hǎan', exZh: '我要去餐馆。' },
  { id: 'w012', thai: 'มา', roman: 'maa', tn: 'M', zh: '来', theme: '打车', exTh: 'มาที่นี่', exRoman: 'maa thîi-nîi', exZh: '来这里。' },
  { id: 'w013', thai: 'อยู่', roman: 'yùu', tn: 'L', zh: '在；住', theme: '居家', exTh: 'ผมอยู่ที่โรงแรม', exRoman: 'phǒm yùu thîi rooŋ-rɛɛm', exZh: '我住在酒店。' },
  { id: 'w014', thai: 'ที่', roman: 'thîi', tn: 'F', zh: '在…（处所）；…的地方；第', theme: '打车', exTh: 'ห้องน้ำอยู่ที่ไหน', exRoman: 'hɔ̂ɔng-náam yùu thîi nǎi', exZh: '洗手间在哪里？' },
  { id: 'w015', thai: 'ไหน', roman: 'nǎi', tn: 'R', zh: '哪；哪里', theme: '打车', exTh: 'คุณไปไหน', exRoman: 'khun pai nǎi', exZh: '你去哪里？' },
  { id: 'w016', thai: 'ตรง', roman: 'trong', tn: 'M', zh: '直；笔直', theme: '打车', exTh: 'เดินตรงไป', exRoman: 'dəən trong pai', exZh: '一直往前走。' },
  { id: 'w017', thai: 'ซ้าย', roman: 'sáai', tn: 'H', zh: '左', theme: '打车', exTh: 'เลี้ยวซ้าย', exRoman: 'líao sáai', exZh: '左转。' },
  { id: 'w018', thai: 'ขวา', roman: 'khwǎa', tn: 'R', zh: '右', theme: '打车', exTh: 'เลี้ยวขวา', exRoman: 'líao khwǎa', exZh: '右转。' },
  { id: 'w019', thai: 'ใกล้', roman: 'klâi', tn: 'F', zh: '近', theme: '打车', exTh: 'โรงแรมอยู่ใกล้ที่นี่', exRoman: 'rooŋ-rɛɛm yùu klâi thîi-nîi', exZh: '酒店离这里很近。' },
  { id: 'w020', thai: 'ไกล', roman: 'klai', tn: 'M', zh: '远', theme: '打车', exTh: 'ไกลไหม', exRoman: 'klai mǎi', exZh: '远吗？' },
  { id: 'w021', thai: 'กิน', roman: 'kin', tn: 'M', zh: '吃', theme: '点餐', exTh: 'กินข้าวหรือยัง', exRoman: 'kin khâao rɯ̌ɯ yang', exZh: '吃饭了吗？（常用问候）' },
  { id: 'w022', thai: 'ดื่ม', roman: 'dɯ̀ɯm', tn: 'L', zh: '喝', theme: '点餐', exTh: 'ดื่มน้ำ', exRoman: 'dɯ̀ɯm náam', exZh: '喝水。' },
  { id: 'w023', thai: 'น้ำ', roman: 'náam', tn: 'H', zh: '水', theme: '点餐', exTh: 'ขอน้ำเปล่า', exRoman: 'khɔ̌ɔ náam plàao', exZh: '请给我白开水。' },
  { id: 'w024', thai: 'ข้าว', roman: 'khâao', tn: 'F', zh: '米饭；饭', theme: '点餐', exTh: 'ข้าวผัดหนึ่งจาน', exRoman: 'khâao phàt nɯ̀ng jaan', exZh: '一份炒饭。' },
  { id: 'w025', thai: 'เผ็ด', roman: 'phèt', tn: 'L', zh: '辣', theme: '点餐', exTh: 'อาหารเผ็ดมาก', exRoman: 'aa-hǎan phèt mâak', exZh: '这菜很辣。' },
  { id: 'w026', thai: 'หวาน', roman: 'wǎan', tn: 'R', zh: '甜', theme: '点餐', exTh: 'กาแฟหวานเกินไป', exRoman: 'kaa-fɛɛ wǎan kəən pai', exZh: '咖啡太甜了。' },
  { id: 'w027', thai: 'ร้อน', roman: 'rɔ́ɔn', tn: 'H', zh: '热；烫', theme: '点餐', exTh: 'วันนี้ร้อนมาก', exRoman: 'wan-níi rɔ́ɔn mâak', exZh: '今天很热。' },
  { id: 'w028', thai: 'เย็น', roman: 'yen', tn: 'M', zh: '凉；冷（也指傍晚）', theme: '点餐', exTh: 'น้ำเย็น', exRoman: 'náam yen', exZh: '冷水；凉的水。' },
  { id: 'w029', thai: 'เงิน', roman: 'ngəən', tn: 'M', zh: '钱；银', theme: '购物', exTh: 'จ่ายเงินสดได้ไหม', exRoman: 'jàai ngəən-sòt dâi mǎi', exZh: '可以付现金吗？' },
  { id: 'w030', thai: 'เท่าไหร่', roman: 'thâo-rài', tn: 'FL', zh: '多少；多少钱', theme: '购物', exTh: 'อันนี้เท่าไหร่', exRoman: 'an-níi thâo-rài', exZh: '这个多少钱？' },
  { id: 'w031', thai: 'ตอนนี้', roman: 'tɔɔn-níi', tn: 'MH', zh: '现在', theme: '时间', exTh: 'ตอนนี้กี่โมง', exRoman: 'tɔɔn-níi kìi mooŋ', exZh: '现在几点？' },
  { id: 'w032', thai: 'วันนี้', roman: 'wan-níi', tn: 'MH', zh: '今天', theme: '时间', exTh: 'วันนี้วันอะไร', exRoman: 'wan-níi wan à-rai', exZh: '今天星期几？' },
  { id: 'w033', thai: 'พรุ่งนี้', roman: 'phrûng-níi', tn: 'FH', zh: '明天', theme: '时间', exTh: 'พรุ่งนี้เจอกัน', exRoman: 'phrûng-níi jəə kan', exZh: '明天见。' },
  { id: 'w034', thai: 'เมื่อวาน', roman: 'mɯ̂a-waan', tn: 'FM', zh: '昨天', theme: '时间', exTh: 'เมื่อวานฝนตก', exRoman: 'mɯ̂a-waan fǒn tòk', exZh: '昨天下雨了。' },
  { id: 'w035', thai: 'เดี๋ยว', roman: 'dǐao', tn: 'R', zh: '等一下；马上', theme: '时间', exTh: 'รอเดี๋ยวนะคะ', exRoman: 'rɔɔ dǐao ná khá', exZh: '请稍等。（女士说）' },
  { id: 'w036', thai: 'รอ', roman: 'rɔɔ', tn: 'M', zh: '等；等待', theme: '时间', exTh: 'ผมรอรถ', exRoman: 'phǒm rɔɔ rót', exZh: '我在等车。' },
  { id: 'w037', thai: 'เดิน', roman: 'dəən', tn: 'M', zh: '走；步行', theme: '打车', exTh: 'เดินไปได้ไหม', exRoman: 'dəən pai dâi mǎi', exZh: '可以走路去吗？' },
  { id: 'w038', thai: 'รถ', roman: 'rót', tn: 'H', zh: '车', theme: '打车', exTh: 'รถติดมาก', exRoman: 'rót tìt mâak', exZh: '堵车很严重。' },
  { id: 'w039', thai: 'ถนน', roman: 'thà-nǒn', tn: 'LR', zh: '路；马路', theme: '打车', exTh: 'เดินข้ามถนน', exRoman: 'dəən khâam thà-nǒn', exZh: '过马路。' },
  { id: 'w040', thai: 'ซอย', roman: 'sɔɔi', tn: 'M', zh: '巷子；小巷', theme: '打车', exTh: 'ซอยนี้ยาว', exRoman: 'sɔɔi níi yaao', exZh: '这条巷子很长。' },
  { id: 'w041', thai: 'เลี้ยว', roman: 'líao', tn: 'H', zh: '转弯', theme: '打车', exTh: 'เลี้ยวซ้ายตรงนั้น', exRoman: 'líao sáai trong nán', exZh: '在那里左转。' },
  { id: 'w042', thai: 'หยุด', roman: 'yùt', tn: 'L', zh: '停；停下', theme: '打车', exTh: 'หยุดที่นี่', exRoman: 'yùt thîi-nîi', exZh: '在这里停。' },
  { id: 'w043', thai: 'ลง', roman: 'long', tn: 'M', zh: '下；下车', theme: '打车', exTh: 'ผมลงที่นี่', exRoman: 'phǒm long thîi-nîi', exZh: '我在这里下车。' },
  { id: 'w044', thai: 'ถึง', roman: 'thɯ̌ng', tn: 'R', zh: '到；到达', theme: '打车', exTh: 'ถึงแล้ว', exRoman: 'thɯ̌ng lɛ́ɛo', exZh: '到了。' },
  { id: 'w045', thai: 'ซื้อ', roman: 'sɯ́ɯ', tn: 'H', zh: '买', theme: '购物', exTh: 'ผมอยากซื้อน้ำ', exRoman: 'phǒm yàak sɯ́ɯ náam', exZh: '我想买水。' },
  { id: 'w046', thai: 'ขาย', roman: 'khǎai', tn: 'R', zh: '卖', theme: '购物', exTh: 'ร้านนี้ขายอะไร', exRoman: 'ráan níi khǎai à-rai', exZh: '这家店卖什么？' },
  { id: 'w047', thai: 'ราคา', roman: 'raa-khaa', tn: 'MM', zh: '价格；价钱', theme: '购物', exTh: 'ราคาเท่าไหร่', exRoman: 'raa-khaa thâo-rài', exZh: '价格是多少？' },
  { id: 'w048', thai: 'แพง', roman: 'phɛɛng', tn: 'M', zh: '贵', theme: '购物', exTh: 'แพงเกินไป', exRoman: 'phɛɛng kəən pai', exZh: '太贵了。' },
  { id: 'w049', thai: 'ถูก', roman: 'thùuk', tn: 'L', zh: '便宜；对；正确', theme: '购物', exTh: 'อันนี้ถูกกว่า', exRoman: 'an-níi thùuk kwàa', exZh: '这个更便宜。' },
  { id: 'w050', thai: 'ลด', roman: 'lót', tn: 'H', zh: '减；降价；打折', theme: '购物', exTh: 'ลดหน่อยได้ไหม', exRoman: 'lót nɔ̀i dâi mǎi', exZh: '能便宜一点吗？' },
  { id: 'w051', thai: 'จ่าย', roman: 'jàai', tn: 'L', zh: '付（款）；支付', theme: '购物', exTh: 'ผมจะจ่ายเงินสด', exRoman: 'phǒm jà jàai ngəən-sòt', exZh: '我付现金。' },
  { id: 'w052', thai: 'ร้าน', roman: 'ráan', tn: 'H', zh: '店；餐馆；铺子', theme: '购物', exTh: 'ร้านอาหารอยู่ใกล้ที่นี่', exRoman: 'ráan aa-hǎan yùu klâi thîi-nîi', exZh: '餐馆就在这附近。' },
]

// 课程（按泰文列出，保持用户给定顺序；重复词共用同一个词汇 ID）
export const SEED_LESSONS: Record<number, string[]> = {
  1: 'สวัสดี ขอบคุณ ขอโทษ ใช่ ไม่ มี ไม่มี เอา ได้ ช่วย ไป มา อยู่ ที่ ไหน ตรง ซ้าย ขวา ใกล้ ไกล กิน ดื่ม น้ำ ข้าว เผ็ด หวาน ร้อน เย็น เงิน เท่าไหร่'.split(' '),
  2: 'ขอโทษ ช่วย มา ดื่ม เย็น เผ็ด หวาน เงิน ตอนนี้ วันนี้ พรุ่งนี้ เมื่อวาน เดี๋ยว รอ เดิน รถ ถนน ซอย เลี้ยว หยุด ลง ถึง ซื้อ ขาย ราคา แพง ถูก ลด จ่าย ร้าน'.split(' '),
}

// 用户已有的熟练度记录（1陌生 2不熟悉 3熟悉 4精通；未列出的 = 未标记，不视为已掌握）
export const SEED_LEVELS: Record<number, string[]> = {
  4: 'สวัสดี ใช่ ไม่ เอา ไป ที่ ซ้าย ขวา กิน น้ำ ข้าว เท่าไหร่'.split(' '),
  3: 'ขอบคุณ มี ไม่มี ได้ อยู่ ไหน ตรง ใกล้ ไกล'.split(' '),
  2: 'ขอโทษ ช่วย มา ดื่ม เย็น'.split(' '),
  1: 'เผ็ด หวาน เงิน'.split(' '),
}

export const SEED_VERSION = 1
export const THEMES = ['日常交流', '打车', '点餐', '购物', '数字', '时间', '居家', '医院', '工作']

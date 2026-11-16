import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { ColorRoman } from '../ui'
import { playFile, playSystem, stopAudio } from '../lib/audio'
import { wordIdFor } from '../lib/ids'
import type { Word } from '../types'

type Tab = 'body' | 'time' | 'week' | 'num' | 'verb'

/** 图解记忆：一边看图、一边认词。图是自己画的示意图（人体、一天的太阳位置、星期对应的星球和颜色），点任何标签读音。 */
export default function Pictures({ onClose }: { onClose: () => void }) {
  const { words, countPlay } = useApp()
  const [tab, setTab] = useState<Tab>('body')
  const [on, setOn] = useState<string | null>(null)
  const [hideZh, setHideZh] = useState(false)
  const byThai = useMemo(() => new Map(words.map(w => [w.thai, w])), [words])
  const say = async (th: string) => {
    const w = byThai.get(th); setOn(th); stopAudio()
    try { if (!w) throw new Error('none'); countPlay(w.id); await playFile(w.id, false) } catch { try { await playSystem(th, false) } catch { /* 没有语音 */ } }
    setOn(o => (o === th ? null : o))
  }
  const Tag = ({ th, zh, cls = '' }: { th: string; zh: string; cls?: string }) => {
    const w: Word | undefined = byThai.get(th)
    return (
      <button className={'pt ' + cls + (on === th ? ' on' : '')} onClick={() => void say(th)} data-testid="pic-tag">
        <b className="th" lang="th">{th}</b>
        {w && <ColorRoman roman={w.roman} className="ptrom" />}
        {!hideZh && <i>{zh}</i>}
      </button>)
  }
  return (
    <div className="study picpage" role="dialog" aria-label="图解记忆">
      <div className="sthead"><button className="close" onClick={() => { stopAudio(); onClose() }}>‹ 返回</button><div className="prog"><b>🖼️ 图解记忆</b></div></div>
      <div className="pictabs">
        {([['body', '🧍 人体'], ['time', '🌅 一天'], ['week', '📅 星期'], ['num', '🔢 数字'], ['verb', '🏃 动词']] as const).map(([k, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-testid={'pictab-' + k}>{n}</button>)}
        <label className="pichide"><input type="checkbox" checked={hideZh} onChange={e => setHideZh(e.target.checked)} /> 遮住中文</label>
      </div>
      <div className="piclist">
        {tab === 'body' && <Body Tag={Tag} />}
        {tab === 'time' && <TimeOfDay Tag={Tag} />}
        {tab === 'week' && <Week Tag={Tag} />}
        {tab === 'verb' && <VerbAtlas byThai={byThai} say={say} on={on} hideZh={hideZh} />}
        {tab === 'num' && <Numbers Tag={Tag} byThai={byThai} countPlay={countPlay} />}
        <p className="sub" style={{ margin: '14px 4px' }}>用法：看图想一想这个词，再点标签听读音；勾「遮住中文」可以自测。图是示意图，不是照片。</p>
      </div>
    </div>)
}
type TagC = (p: { th: string; zh: string; cls?: string }) => React.ReactElement

/* ───────────── 人体 ───────────── */
const SKIN = '#f3cda6', SHIRT = '#8ec5ff', PANTS = '#6e7bd9', HAIR = '#4b3426'
const S = 0.86
const tp = (x: number, y: number): [number, number] => [200 + (x - 150) * S, 14 + y * S]
// [泰文, 中文, 侧(L/R), 标签 y（0–580）, 指向点（图坐标，人物中心 x=150）]
const mk = (side: 'L' | 'R', rows: [string, string, number, number][]): [string, string, 'L' | 'R', number, number, number][] =>
  rows.map(([th, zh, x, y], i) => [th, zh, side, 26 + i * (530 / (rows.length - 1)), x, y])
const place = (rows: [string, string, number, number][]) => {      // 标签 y 贴近指向点，互相至少隔 42，避免重叠
  let prev = -99
  return rows.map(([th, zh, x, y]) => { const ty = tp(x, y)[1]; const ly = Math.max(ty, prev + 42); prev = ly; return { th, zh, x, y, ly } })
}
const BODY_L = place([['หัว', '头', 126, 40], ['คอ', '脖子', 144, 122], ['ไหล่', '肩膀', 98, 150], ['แขน', '手臂', 78, 204], ['ศอก', '手肘', 64, 248], ['ข้อมือ', '手腕', 58, 316], ['มือ', '手', 54, 334], ['นิ้วมือ', '手指', 52, 350], ['เล็บ', '指甲', 50, 357]])
const BODY_R = place([['หน้าอก', '胸', 176, 176], ['หัวใจ', '心脏', 169, 196], ['ท้อง', '肚子', 170, 262], ['เอว', '腰', 204, 312], ['ต้นขา', '大腿', 176, 370], ['เข่า', '膝盖', 178, 420], ['น่อง', '小腿肚', 180, 462], ['ข้อเท้า', '脚踝', 180, 508], ['เท้า', '脚', 190, 538], ['นิ้วเท้า', '脚趾', 198, 546]])
const PARTS: [string, string, 'L' | 'R', number, number, number][] = [
  ...BODY_L.map(r => [r.th, r.zh, 'L', r.ly, r.x, r.y] as [string, string, 'L', number, number, number]),
  ...BODY_R.map(r => [r.th, r.zh, 'R', r.ly, r.x, r.y] as [string, string, 'R', number, number, number]),
]
function Body({ Tag }: { Tag: TagC }) {
  return (
    <div>
      <div className="bodywrap" data-testid="body-fig" style={{ aspectRatio: '400 / 580' }}>
        <svg viewBox="0 0 400 580" className="bodysvg" aria-hidden>
          <g transform="translate(200 14) scale(0.86) translate(-150 0)">
            {/* 腿 */}
            <line x1="128" y1="318" x2="122" y2="420" stroke={PANTS} strokeWidth="40" strokeLinecap="round" />
            <line x1="172" y1="318" x2="178" y2="420" stroke={PANTS} strokeWidth="40" strokeLinecap="round" />
            <line x1="122" y1="420" x2="120" y2="508" stroke={SKIN} strokeWidth="26" strokeLinecap="round" />
            <line x1="178" y1="420" x2="180" y2="508" stroke={SKIN} strokeWidth="26" strokeLinecap="round" />
            <ellipse cx="116" cy="538" rx="24" ry="11" fill={SKIN} /><ellipse cx="184" cy="538" rx="24" ry="11" fill={SKIN} />
            {[0, 1, 2, 3, 4].map(i => <circle key={'a' + i} cx={96 + i * 5} cy={546 - (i === 0 ? 0 : 1)} r="3.2" fill="#e7b98e" />)}
            {[0, 1, 2, 3, 4].map(i => <circle key={'b' + i} cx={180 + i * 5} cy={546 - (i === 4 ? 0 : 1)} r="3.2" fill="#e7b98e" />)}
            {/* 躯干 */}
            <path d="M98 142 Q150 126 202 142 L210 158 L206 322 L94 322 L90 158 Z" fill={SHIRT} />
            <rect x="94" y="300" width="112" height="22" rx="6" fill={PANTS} />
            {/* 手臂 */}
            <line x1="92" y1="160" x2="64" y2="248" stroke={SHIRT} strokeWidth="26" strokeLinecap="round" />
            <line x1="208" y1="160" x2="236" y2="248" stroke={SHIRT} strokeWidth="26" strokeLinecap="round" />
            <line x1="64" y1="248" x2="58" y2="318" stroke={SKIN} strokeWidth="22" strokeLinecap="round" />
            <line x1="236" y1="248" x2="242" y2="318" stroke={SKIN} strokeWidth="22" strokeLinecap="round" />
            <circle cx="56" cy="334" r="14" fill={SKIN} /><circle cx="244" cy="334" r="14" fill={SKIN} />
            {[-8, -3, 2, 7].map(d => <line key={'l' + d} x1={56 + d} y1="344" x2={54 + d * 1.3} y2="356" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />)}
            {[-8, -3, 2, 7].map(d => <line key={'r' + d} x1={244 + d} y1="344" x2={242 + d * 1.3} y2="356" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />)}
            {[-8, -3, 2, 7].map(d => <circle key={'nl' + d} cx={54 + d * 1.3} cy="357" r="2.2" fill="#f4a9a0" />)}
            {/* 心 */}
            <path d="M158 190 c0-6 8-8 11-2 c3-6 11-4 11 2 c0 7-11 14-11 14 s-11-7-11-14z" fill="#ee5a6f" />
            {/* 脖子 头 */}
            <rect x="140" y="106" width="20" height="30" rx="8" fill={SKIN} />
            <ellipse cx="108" cy="78" rx="6" ry="11" fill={SKIN} /><ellipse cx="192" cy="78" rx="6" ry="11" fill={SKIN} />
            <ellipse cx="150" cy="70" rx="40" ry="46" fill={SKIN} />
            <path d="M108 70 C104 18 196 18 192 70 C184 44 116 44 108 70 Z" fill={HAIR} />
            <path d="M124 58 q10-6 20 0 M156 58 q10-6 20 0" stroke={HAIR} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <circle cx="134" cy="70" r="4.5" fill="#2a2a2a" /><circle cx="166" cy="70" r="4.5" fill="#2a2a2a" />
            <path d="M150 74 q-5 12 0 14 q4 0 5-2" stroke="#d9a67e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M138 100 q12 10 24 0" stroke="#d6606e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <circle cx="124" cy="90" r="6" fill="#f6a8a0" opacity=".55" /><circle cx="176" cy="90" r="6" fill="#f6a8a0" opacity=".55" />
          </g>
          {PARTS.map(([th, , side, ly, tx, ty]) => {
            const [px, py] = tp(tx, ty)
            return <g key={th}><line x1={side === 'L' ? 98 : 302} y1={ly} x2={px} y2={py} stroke="#9aa6c4" strokeWidth="1.1" /><circle cx={px} cy={py} r="3" fill="#3b82ff" /></g>
          })}
        </svg>
        {PARTS.map(([th, zh, side, ly]) => (
          <div key={th} className={'bodylab ' + side} style={{ top: `${(ly / 580) * 100}%` }}><Tag th={th} zh={zh} cls="small" /></div>))}
      </div>
      <h3 className="pich">脸部（放大看）</h3>
      <FaceFig Tag={Tag} />
      <h3 className="pich">看不到的、其他的</h3>
      <div className="ptrow">
        <Tag th="หลัง" zh="后背" /><Tag th="ก้น" zh="屁股" /><Tag th="ผิว" zh="皮肤" /><Tag th="ศีรษะ" zh="头（正式）" /><Tag th="ร่างกาย" zh="身体" /><Tag th="ส้นเท้า" zh="脚后跟" /><Tag th="นิ้วเท้า" zh="脚趾" />
      </div>
    </div>)
}

const FACE_L: [string, string, number, number][] = [['ผม', '头发', 150, 92], ['หู', '耳朵', 108, 190], ['แก้ม', '脸颊', 142, 218], ['ฟัน', '牙齿', 178, 247], ['คอ', '脖子', 190, 318]]
const FACE_R: [string, string, number, number][] = [["หน้าผาก", "额头", 208, 124], ['คิ้ว', '眉毛', 238, 138], ['ตา', '眼睛', 244, 164], ['จมูก', '鼻子', 208, 205], ['ปาก', '嘴', 246, 246], ['ลิ้น', '舌头', 212, 272], ['คาง', '下巴', 222, 292]]
function FaceFig({ Tag }: { Tag: TagC }) {
  const ys = (n: number) => Array.from({ length: n }, (_, i) => 24 + i * (310 / (n - 1)))
  const L = ys(FACE_L.length), R = ys(FACE_R.length)
  return (
    <div className="bodywrap" data-testid="face-fig" style={{ aspectRatio: '400 / 360' }}>
      <svg viewBox="0 0 400 360" className="bodysvg" aria-hidden>
        <rect x="176" y="270" width="48" height="70" rx="14" fill={SKIN} /><path d="M120 360 Q200 316 280 360 Z" fill={SHIRT} />
        <ellipse cx="108" cy="188" rx="13" ry="24" fill={SKIN} /><ellipse cx="292" cy="188" rx="13" ry="24" fill={SKIN} />
        <ellipse cx="200" cy="180" rx="92" ry="108" fill={SKIN} />
        <path d="M106 176 C92 40 308 40 294 176 C286 84 114 84 106 176 Z" fill={HAIR} />
        <path d="M150 140 q22 -14 44 0 M206 140 q22 -14 44 0" stroke={HAIR} strokeWidth="5" fill="none" strokeLinecap="round" />
        <ellipse cx="172" cy="164" rx="15" ry="10" fill="#fff" /><ellipse cx="228" cy="164" rx="15" ry="10" fill="#fff" />
        <circle cx="172" cy="164" r="6.5" fill="#2a2a2a" /><circle cx="228" cy="164" r="6.5" fill="#2a2a2a" />
        <path d="M200 176 q-13 36 -1 40 q11 2 15 -6" stroke="#d9a67e" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <circle cx="140" cy="216" r="15" fill="#f6a8a0" opacity=".5" /><circle cx="260" cy="216" r="15" fill="#f6a8a0" opacity=".5" />
        <path d="M158 240 Q200 306 242 240 Z" fill="#7a2730" />
        <path d="M163 242 Q200 262 237 242 L233 253 Q200 271 167 253 Z" fill="#fff" />
        <ellipse cx="200" cy="274" rx="21" ry="9" fill="#e8808a" />
        <path d="M156 240 Q200 310 244 240" stroke="#d6606e" strokeWidth="4" fill="none" strokeLinecap="round" />
        {FACE_L.map(([th, , x, y], i) => <g key={th}><line x1="98" y1={L[i]} x2={x} y2={y} stroke="#9aa6c4" strokeWidth="1.1" /><circle cx={x} cy={y} r="3" fill="#3b82ff" /></g>)}
        {FACE_R.map(([th, , x, y], i) => <g key={th}><line x1="302" y1={R[i]} x2={x} y2={y} stroke="#9aa6c4" strokeWidth="1.1" /><circle cx={x} cy={y} r="3" fill="#3b82ff" /></g>)}
      </svg>
      {FACE_L.map(([th, zh], i) => <div key={th} className="bodylab L" style={{ top: `${(L[i] / 360) * 100}%` }}><Tag th={th} zh={zh} cls="small" /></div>)}
      {FACE_R.map(([th, zh], i) => <div key={th} className="bodylab R" style={{ top: `${(R[i] / 360) * 100}%` }}><Tag th={th} zh={zh} cls="small" /></div>)}
    </div>)
}

/* ───────────── 一天 ───────────── */
interface Scene { th: string; zh: string; hint: string; t: number | null; sky: [string, string]; moon?: boolean; stars?: number; glow?: string }
const SCENES: Scene[] = [
  { th: 'เช้ามืด', zh: '凌晨', hint: '约 4–6 点', t: -0.04, sky: ['#2c3a73', '#f2a97b'], stars: 8, glow: '#f7c58f' },
  { th: 'เช้า', zh: '早上', hint: '约 6–9 点 · 太阳刚升起', t: 0.1, sky: ['#7fb3ea', '#ffd29a'] },
  { th: 'สาย', zh: '上午晚些', hint: '约 9–11 点 · 比 เช้า 晚', t: 0.3, sky: ['#5aa6f0', '#cfe6ff'] },
  { th: 'เที่ยง', zh: '中午', hint: '约 12 点 · 太阳在头顶', t: 0.5, sky: ['#2f7de0', '#a9d3ff'] },
  { th: 'บ่าย', zh: '下午', hint: '约 13–16 点', t: 0.68, sky: ['#4a9bef', '#c6e3ff'] },
  { th: 'เย็น', zh: '傍晚', hint: '约 16–18 点 · 太阳要落了（也有「凉」的意思）', t: 0.9, sky: ['#f0905c', '#ffd9a0'] },
  { th: 'ค่ำ', zh: '天刚黑', hint: '约 18–21 点 · 太阳已落，天色暗下来', t: 1.04, sky: ['#41306e', '#e07b7b'], stars: 5, moon: true },
  { th: 'คืน', zh: '夜晚', hint: '晚上 · 整个夜里', t: null, sky: ['#101a3a', '#27396f'], moon: true, stars: 14 },
  { th: 'ดึก', zh: '深夜', hint: '约 23–3 点 · 夜深人静', t: null, sky: ['#070b1e', '#16204a'], moon: true, stars: 22 },
]
function SceneSvg({ s }: { s: Scene }) {
  const W = 220, H = 120, cx = 110, base = 96, R = 86
  const id = 'sk' + s.th.length + (s.t ?? 'n') + s.zh
  const sun = s.t !== null ? { x: cx - R * Math.cos(s.t * Math.PI), y: base - R * 0.95 * Math.sin(Math.max(s.t, -0.12) * Math.PI) } : null
  const stars = Array.from({ length: s.stars ?? 0 }, (_, i) => ({ x: (i * 53 + 17) % (W - 10) + 5, y: ((i * 37 + 11) % 54) + 6 }))
  const dark = s.sky[0] < '#5'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="scene" aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.sky[0]} /><stop offset="1" stopColor={s.sky[1]} /></linearGradient></defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
      {stars.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i % 3 === 0 ? 1.6 : 1.1} fill="#fff" opacity=".85" />)}
      {s.glow && <ellipse cx={cx - 30} cy={base} rx="80" ry="24" fill={s.glow} opacity=".55" />}
      {sun && <g><circle cx={sun.x} cy={sun.y} r="15" fill={dark ? '#ffd35c' : '#ffcf3f'} opacity=".35" /><circle cx={sun.x} cy={sun.y} r="10" fill="#ffcf3f" />
        {[...Array(8)].map((_, i) => { const a = i * Math.PI / 4; return <line key={i} x1={sun.x + Math.cos(a) * 14} y1={sun.y + Math.sin(a) * 14} x2={sun.x + Math.cos(a) * 19} y2={sun.y + Math.sin(a) * 19} stroke="#ffcf3f" strokeWidth="2" strokeLinecap="round" />})}</g>}
      {s.moon && <g><circle cx={s.th === 'ดึก' ? 150 : 160} cy={s.th === 'ค่ำ' ? 40 : 30} r="11" fill="#f6f1d3" /><circle cx={(s.th === 'ดึก' ? 150 : 160) + 5} cy={(s.th === 'ค่ำ' ? 40 : 30) - 3} r="10" fill={s.sky[0]} /></g>}
      <path d={`M0 ${base} Q40 ${base - 16} 80 ${base - 4} T170 ${base - 6} T${W} ${base - 2} V${H} H0 Z`} fill={s.stars && s.stars > 3 ? '#0c1224' : '#3f7a4f'} />
      <rect x="150" y={base - 22} width="22" height="26" fill={s.stars && s.stars > 3 ? '#0a0f1e' : '#8b6a4f'} /><path d={`M146 ${base - 22} L161 ${base - 36} L176 ${base - 22} Z`} fill={s.stars && s.stars > 3 ? '#080c18' : '#c6544a'} />
      {s.stars && s.stars > 3 && <rect x="157" y={base - 14} width="7" height="8" fill="#ffd35c" opacity={s.th === 'ดึก' ? 0 : 0.9} />}
      {s.th === 'ดึก' && <text x="168" y="20" fontSize="12" fill="#cfd8ff" opacity=".9">z z z</text>}
    </svg>)
}
function TimeOfDay({ Tag }: { Tag: TagC }) {
  return (
    <div>
      <div className="daybar" data-testid="day-bar">
        <div style={{ flex: 5, background: 'linear-gradient(90deg,#7fb3ea,#2f7de0 50%,#f0905c)' }}><Tag th="กลางวัน" zh="白天" cls="small inv" /></div>
        <div style={{ flex: 4, background: 'linear-gradient(90deg,#41306e,#070b1e)' }}><Tag th="กลางคืน" zh="夜里" cls="small inv" /></div>
      </div>
      <div className="scenes">
        {SCENES.map(s => (
          <div key={s.th} className="scenecard" data-testid="scene">
            <SceneSvg s={s} />
            <div className="scenetxt"><Tag th={s.th} zh={s.zh} /><span className="schint">{s.hint}</span></div>
          </div>))}
      </div>
      <h3 className="pich">天空里的东西</h3>
      <div className="ptrow">
        <Tag th="พระอาทิตย์" zh="太阳" /><Tag th="พระอาทิตย์ขึ้น" zh="日出" /><Tag th="พระอาทิตย์ตก" zh="日落" /><Tag th="พระจันทร์" zh="月亮" /><Tag th="ดาว" zh="星星" /><Tag th="ท้องฟ้า" zh="天空" /><Tag th="เมฆ" zh="云" /><Tag th="แดด" zh="阳光" /><Tag th="มืด" zh="黑" /><Tag th="สว่าง" zh="亮" /><Tag th="เช้ามืด" zh="凌晨" /><Tag th="เที่ยงคืน" zh="半夜12点" />
      </div>
    </div>)
}

/* ───────────── 星期 ───────────── */
const DAYS: { th: string; zh: string; star: string; color: string; planet: 'sun' | 'moon' | 'mars' | 'mercury' | 'jupiter' | 'venus' | 'saturn'; colorZh: string }[] = [
  { th: 'วันอาทิตย์', zh: '星期日', star: '太阳', color: '#e8484a', planet: 'sun', colorZh: '红色' },
  { th: 'วันจันทร์', zh: '星期一', star: '月亮', color: '#f6d84c', planet: 'moon', colorZh: '黄色' },
  { th: 'วันอังคาร', zh: '星期二', star: '火星', color: '#f58bb7', planet: 'mars', colorZh: '粉红色' },
  { th: 'วันพุธ', zh: '星期三', star: '水星', color: '#4fb86a', planet: 'mercury', colorZh: '绿色' },
  { th: 'วันพฤหัส', zh: '星期四', star: '木星', color: '#f59a3d', planet: 'jupiter', colorZh: '橙色' },
  { th: 'วันศุกร์', zh: '星期五', star: '金星', color: '#58b4e8', planet: 'venus', colorZh: '浅蓝色' },
  { th: 'วันเสาร์', zh: '星期六', star: '土星', color: '#9b6fd6', planet: 'saturn', colorZh: '紫色' },
]
function Planet({ k }: { k: typeof DAYS[number]['planet'] }) {
  return (
    <svg viewBox="0 0 60 60" className="planet" aria-hidden>
      {k === 'sun' && <g><circle cx="30" cy="30" r="12" fill="#ffd23f" />{[...Array(10)].map((_, i) => { const a = i * Math.PI / 5; return <line key={i} x1={30 + Math.cos(a) * 16} y1={30 + Math.sin(a) * 16} x2={30 + Math.cos(a) * 23} y2={30 + Math.sin(a) * 23} stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" />})}</g>}
      {k === 'moon' && <g><circle cx="30" cy="30" r="17" fill="#fff6c9" /><circle cx="38" cy="25" r="15" fill="#f6d84c" /></g>}
      {k === 'mars' && <g><circle cx="30" cy="30" r="16" fill="#d9573a" /><circle cx="24" cy="26" r="3" fill="#b8402a" /><circle cx="35" cy="35" r="2.5" fill="#b8402a" /></g>}
      {k === 'mercury' && <g><circle cx="30" cy="30" r="11" fill="#9aa1ab" /><circle cx="26" cy="27" r="2.2" fill="#7d848e" /><circle cx="34" cy="34" r="1.8" fill="#7d848e" /></g>}
      {k === 'jupiter' && <g><circle cx="30" cy="30" r="19" fill="#e6b27a" /><path d="M12 24 Q30 20 48 24 M11 31 Q30 35 49 31 M14 38 Q30 41 46 38" stroke="#c4824a" strokeWidth="3" fill="none" /><ellipse cx="38" cy="35" rx="4" ry="2.5" fill="#b9573a" /></g>}
      {k === 'venus' && <g><circle cx="30" cy="30" r="15" fill="#f3e6b0" /><path d="M18 26 Q30 20 42 28" stroke="#e8d27a" strokeWidth="3" fill="none" /></g>}
      {k === 'saturn' && <g><circle cx="30" cy="30" r="12" fill="#d9b985" /><ellipse cx="30" cy="31" rx="24" ry="7" fill="none" stroke="#a98fd0" strokeWidth="3.2" transform="rotate(-18 30 31)" /></g>}
    </svg>)
}
function Week({ Tag }: { Tag: TagC }) {
  return (
    <div>
      <p className="sub" style={{ margin: '4px 4px 10px' }}>泰国的星期按「星球 + 颜色」来记：วัน（日）+ 天体名。每天还有一个传统颜色，很多人会照着穿衣服。</p>
      <div className="weekgrid">
        {DAYS.map(d => (
          <div key={d.th} className="daycard" style={{ borderColor: d.color, background: d.color + '1f' }} data-testid="day-card">
            <div className="dayicon" style={{ background: d.color + '55' }}><Planet k={d.planet} /></div>
            <Tag th={d.th} zh={d.zh} />
            <div className="daystar">{d.star}日 · <span style={{ color: d.color, fontWeight: 700 }}>●</span> {d.colorZh}</div>
          </div>))}
      </div>
      <h3 className="pich">和星期有关</h3>
      <div className="ptrow"><Tag th="อาทิตย์" zh="星期；周" /><Tag th="สัปดาห์" zh="星期；周" /><Tag th="วัน" zh="天；日" /></div>
    </div>)
}


/* ───────────── 数字 ───────────── */
const TH_DIGIT = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙']
const DIGIT_WORD = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const DOTS: number[][] = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8], [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]]
function Dots({ n }: { n: number }) {
  return (
    <svg viewBox="0 0 60 60" className="dots" aria-hidden>
      <rect x="2" y="2" width="56" height="56" rx="12" fill="#fff" stroke="#c9d3ea" strokeWidth="2" />
      {n === 0 && <circle cx="30" cy="30" r="10" fill="none" stroke="#b7c2dc" strokeWidth="3" strokeDasharray="3 4" />}
      {DOTS[n].map(i => <circle key={i} cx={14 + (i % 3) * 16} cy={14 + Math.floor(i / 3) * 16} r="5.5" fill="#3b82ff" />)}
    </svg>)
}
const Bag = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}><path d="M6 6 Q12 0 18 6 L22 8 Q24 22 20 26 H4 Q0 22 2 8 Z" fill="#e2a93a" stroke="#b9801f" strokeWidth="1.2" /><path d="M7 6 H17" stroke="#b9801f" strokeWidth="2" /><text x="12" y="20" fontSize="8" textAnchor="middle" fill="#7a4c0c" fontWeight="700">万</text></g>)
function PlacePic({ k }: { k: 'ten' | 'hun' | 'tho' | 'wan' | 'san' | 'lan' }) {
  const cell = '#3b82ff'
  if (k === 'ten') return <svg viewBox="0 0 120 60" className="pp" aria-hidden>{Array.from({ length: 10 }, (_, i) => <rect key={i} x={6 + i * 10.6} y="22" width="9" height="16" rx="2" fill={cell} />)}</svg>
  if (k === 'hun') return <svg viewBox="0 0 120 60" className="pp" aria-hidden>{Array.from({ length: 100 }, (_, i) => <rect key={i} x={30 + (i % 10) * 6} y={2 + Math.floor(i / 10) * 5.6} width="5" height="4.6" rx="1" fill={cell} />)}</svg>
  if (k === 'tho') return <svg viewBox="0 0 120 60" className="pp" aria-hidden>{Array.from({ length: 10 }, (_, i) => <g key={i} transform={`translate(${14 + i * 4} ${44 - i * 3.6})`}><rect width="50" height="14" rx="2" fill={i % 2 ? '#5b9cff' : '#3b82ff'} stroke="#fff" strokeWidth="1" /></g>)}</svg>
  if (k === 'wan') return <svg viewBox="0 0 120 60" className="pp" aria-hidden><Bag x={46} y={14} s={1.5} /></svg>
  if (k === 'san') return <svg viewBox="0 0 120 60" className="pp" aria-hidden>{Array.from({ length: 10 }, (_, i) => <Bag key={i} x={4 + (i % 5) * 22} y={4 + Math.floor(i / 5) * 28} s={0.85} />)}</svg>
  return <svg viewBox="0 0 120 60" className="pp" aria-hidden>{Array.from({ length: 100 }, (_, i) => <Bag key={i} x={4 + (i % 10) * 11.4} y={2 + Math.floor(i / 10) * 5.7} s={0.36} />)}</svg>
}
const PLACES: { k: 'ten' | 'hun' | 'tho' | 'wan' | 'san' | 'lan'; th: string; zh: string; n: string; eq: string }[] = [
  { k: 'ten', th: 'สิบ', zh: '十', n: '10', eq: '10 个 1（หนึ่ง）' },
  { k: 'hun', th: 'ร้อย', zh: '百', n: '100', eq: '10 个 สิบ' },
  { k: 'tho', th: 'พัน', zh: '千', n: '1,000', eq: '10 个 ร้อย（10 层 100 叠起来）' },
  { k: 'wan', th: 'หมื่น', zh: '万', n: '10,000', eq: '10 个 พัน（一袋＝一万）' },
  { k: 'san', th: 'แสน', zh: '十万', n: '100,000', eq: '10 个 หมื่น（10 袋）' },
  { k: 'lan', th: 'ล้าน', zh: '百万', n: '1,000,000', eq: '10 个 แสน（100 袋）' },
]
// 把数字读成泰语：[词, 是不是「改读」]。规则：十位是 1 只读 สิบ；十位是 2 读 ยี่สิบ；个位 1 在别的数后面读 เอ็ด
function readNum(n: number): { w: string; note?: string }[] {
  if (n === 0) return [{ w: 'ศูนย์' }]
  const out: { w: string; note?: string }[] = []
  const grp = (m: number, tail: boolean) => {
    const ps = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']
    for (let p = 5; p >= 0; p--) {
      const d = Math.floor(m / 10 ** p) % 10; if (!d) continue
      if (p === 0) { out.push(d === 1 && (m > 1 || tail) ? { w: 'เอ็ด', note: '个位的 1 接在别的数后面，读 เอ็ด 不读 หนึ่ง' } : { w: DIGIT_WORD[d] }); continue }
      if (p === 1 && d === 1) { out.push({ w: 'สิบ' }); continue }
      if (p === 1 && d === 2) { out.push({ w: 'ยี่', note: '二十的「二」读 ยี่，不读 สอง' }, { w: 'สิบ' }); continue }
      out.push({ w: DIGIT_WORD[d] }, { w: ps[p] })
    }
  }
  const rec = (m: number) => {
    if (m >= 1e6) { rec(Math.floor(m / 1e6)); out.push({ w: 'ล้าน' }); if (m % 1e6) grp(m % 1e6, true) } else grp(m, false)
  }
  rec(n)
  return out
}
function Numbers({ Tag, byThai, countPlay }: { Tag: TagC; byThai: Map<string, Word>; countPlay: (id: string) => void }) {
  const [val, setVal] = useState('21')
  const [busy, setBusy] = useState(false)
  const extra: Record<string, { id: string; roman: string }> = { 'เอ็ด': { id: 'prt-' + wordIdFor('เอ็ด'), roman: 'èt' }, 'ยี่': { id: 'prt-' + wordIdFor('ยี่'), roman: 'yîi' } }
  const n = Math.min(Math.max(parseInt(val.replace(/[^0-9]/g, '') || '0', 10), 0), 99999999)
  const toks = readNum(n)
  const romanOf = (w: string) => extra[w]?.roman ?? byThai.get(w)?.roman ?? ''
  const play = async () => {
    if (busy) { stopAudio(); setBusy(false); return }
    setBusy(true)
    try {
      for (const t of toks) {
        const e = extra[t.w], lw = byThai.get(t.w)
        if (lw) countPlay(lw.id)
        try { await playFile(e?.id ?? lw?.id ?? '', false) } catch { try { await playSystem(t.w, false) } catch { /* 没有语音 */ } }
        await new Promise(r => setTimeout(r, 120))
      }
    } finally { setBusy(false) }
  }
  const notes = [...new Set(toks.map(t => t.note).filter(Boolean))]
  return (
    <div>
      <h3 className="pich" style={{ marginTop: 4 }}>个位 0–9（骰子点数 + 泰国数字 ๐–๙）</h3>
      <div className="digitgrid">
        {DIGIT_WORD.map((w, i) => (
          <div key={w} className="digitcard" data-testid="digit-card">
            <div className="digitnum"><b>{i}</b><span className="thdig">{TH_DIGIT[i]}</span></div>
            <Dots n={i} />
            <Tag th={w} zh={String(i)} cls="small" />
          </div>))}
      </div>
      <h3 className="pich">十 · 百 · 千 · 万（每一级是上一级的 10 倍）</h3>
      <div className="placelist">
        {PLACES.map(p => (
          <div key={p.k} className="placecard" data-testid="place-card">
            <PlacePic k={p.k} />
            <div className="placetxt"><Tag th={p.th} zh={`${p.zh} ${p.n}`} /><span className="schint">{p.eq}</span></div>
          </div>))}
      </div>
      <h3 className="pich">读一个数字试试</h3>
      <div className="numbuild" data-testid="num-build">
        <input inputMode="numeric" value={val} onChange={e => setVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))} aria-label="输入数字" data-testid="num-input" />
        <div className="numout">
          <div className="th numth" lang="th" data-testid="num-th">{toks.map(t => t.w).join('')}</div>
          <div className="numrom">{toks.map((t, i) => <span key={i}><ColorRoman roman={romanOf(t.w)} className="relrom" />{' '}</span>)}</div>
          <button className="numplay" onClick={() => void play()} data-testid="num-play">{busy ? '⏹ 停止' : '🔊 读出来'}</button>
        </div>
        {notes.map(t => <p key={t} className="numnote" data-testid="num-note">💡 {t}</p>)}
        <div className="ptrow" style={{ marginTop: 8 }}>{['11', '20', '21', '101', '1000', '12345'].map(x => <button key={x} className="numchip" onClick={() => setVal(x)}>{Number(x).toLocaleString('en-US')}</button>)}</div>
      </div>
    </div>)
}


/* ───────────── 动词图集 ───────────── */
interface VSec { id: string; name: string; emoji: string; items: { th: string; pic: string }[] }
let verbCache: Promise<VSec[]> | null = null
const loadVerbs = () => (verbCache ??= fetch(`${import.meta.env.BASE_URL}content/verbs.json`).then(r => r.ok ? r.json() : { sections: [] }).then(j => j.sections as VSec[]).catch(() => { verbCache = null; return [] }))

/** 动词图集：每个动词一张图（emoji），按场景分 21 组。可以「遮住泰文」看图想词，点一下翻开并读音。 */
function VerbAtlas({ byThai, say, on, hideZh }: { byThai: Map<string, Word>; say: (th: string) => Promise<void>; on: string | null; hideZh: boolean }) {
  const [secs, setSecs] = useState<VSec[] | null>(null)
  const [hideTh, setHideTh] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const refs = useRef(new Map<string, HTMLElement>())
  useEffect(() => { let ok = true; loadVerbs().then(d => ok && setSecs(d)); return () => { ok = false } }, [])
  const total = secs?.reduce((a, x) => a + x.items.length, 0) ?? 0
  return (
    <div data-testid="verb-atlas">
      <label className="verbhide"><input type="checkbox" checked={hideTh} onChange={e => { setHideTh(e.target.checked); setOpen(new Set()) }} data-testid="verb-hideth" /> 遮住泰文（看图想词，点一下翻开并读音）</label>
      <div className="verbtoc">
        {secs?.map(x => <button key={x.id} onClick={() => refs.current.get(x.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{x.emoji} {x.name}</button>)}
      </div>
      {secs?.map(sec => (
        <section key={sec.id} ref={el => { if (el) refs.current.set(sec.id, el) }} className="versec" data-testid="verb-sec">
          <h3 className="pich">{sec.emoji} {sec.name}</h3>
          <div className="verbgrid">
            {sec.items.map(it => {
              const w = byThai.get(it.th); const hidden = hideTh && !open.has(sec.id + it.th)
              return (
                <button key={it.th} className={'verbcard' + (on === it.th ? ' on' : '')} onClick={() => { if (hidden) setOpen(new Set(open).add(sec.id + it.th)); void say(it.th) }} data-testid="verb-card">
                  <span className="verbpic">{it.pic}</span>
                  {hidden ? <b className="th qmark">？</b> : <>
                    <b className="th" lang="th">{it.th}</b>
                    {w && <ColorRoman roman={w.roman} className="ptrom" />}
                    {!hideZh && w && <i>{w.zh.split(/[；;（(]/)[0]}</i>}
                  </>}
                </button>)
            })}
          </div>
        </section>))}
      <p className="sub" style={{ margin: '10px 4px' }}>共 {secs?.length ?? 0} 组 {total} 个动词。图是 emoji，外观随手机系统不同；有的动词用一张图概括，意思以文字为准。</p>
    </div>)
}

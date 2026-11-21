import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/** 3D 人体：用基本几何体拼出来的小人（不依赖外部模型文件）。拖动旋转；点哪个部位，哪个部位就亮起来并回调 onPick(泰文)。
 *  每个可点的网格在 userData.key 里记着对应的泰文词；左右对称的部位共用同一个词。 */
export interface Body3DProps { selected: string | null; onPick: (th: string) => void; zoom: 'body' | 'face'; onFail?: () => void }

const SKIN = 0xf2c7a3, SKIN2 = 0xeab894, HAIR = 0x2b2320, HI = 0x2f7bff
const BACK_KEYS = new Set(['หลัง', 'ก้น', 'ส้นเท้า', 'น่อง'])

function buildBody() {
  const root = new THREE.Group()
  const mats = new Map<string, THREE.MeshStandardMaterial[]>()
  const centers = new Map<string, THREE.Vector3[]>()
  const add = (key: string | null, geo: THREE.BufferGeometry, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], color = SKIN, rot?: [number, number, number]) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02 })
    const mesh = new THREE.Mesh(geo, m)
    mesh.position.set(...pos); mesh.scale.set(...scale); if (rot) mesh.rotation.set(...rot)
    if (key) { mesh.userData.key = key; mesh.userData.base = scale; mats.set(key, [...(mats.get(key) ?? []), m]); centers.set(key, [...(centers.get(key) ?? []), new THREE.Vector3(...pos)]) }
    root.add(mesh); return mesh
  }
  const sph = (seg = 28) => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7))
  const front = () => new THREE.SphereGeometry(1, 28, 20, 0, Math.PI)          // 前半个球（z ≥ 0）
  const back = () => new THREE.SphereGeometry(1, 28, 20, Math.PI, Math.PI)     // 后半个球
  const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 16)
  const both = (f: (s: 1 | -1) => void) => { f(1); f(-1) }

  // —— 头和脸 ——
  add('หัว', sph(36), [0, 1.6, 0], [0.105, 0.124, 0.11])
  add('ผม', new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.46), [0, 1.612, -0.006], [0.113, 0.128, 0.118], HAIR)
  add('ผม', back(), [0, 1.585, -0.012], [0.112, 0.12, 0.112], HAIR)
  add('หน้าผาก', sph(), [0, 1.663, 0.083], [0.066, 0.026, 0.02], 0xf6d2b1)
  both(s => add('คิ้ว', new THREE.BoxGeometry(1, 1, 1), [0.04 * s, 1.637, 0.098], [0.036, 0.008, 0.01], 0x3a2c25, [0, 0, -0.12 * s]))
  both(s => { add('ตา', sph(), [0.04 * s, 1.613, 0.092], [0.017, 0.012, 0.008], 0xffffff); add('ตา', sph(), [0.04 * s, 1.613, 0.099], [0.008, 0.008, 0.004], 0x222222) })
  add('จมูก', sph(), [0, 1.585, 0.108], [0.016, 0.026, 0.02], SKIN2)
  both(s => add('แก้ม', sph(), [0.06 * s, 1.568, 0.074], [0.03, 0.028, 0.02], 0xf3b5a2))
  add('ปาก', sph(), [0, 1.546, 0.097], [0.03, 0.009, 0.01], 0xc0504d)
  add('คาง', sph(), [0, 1.507, 0.066], [0.03, 0.02, 0.024], SKIN2)
  both(s => add('หู', sph(), [0.107 * s, 1.6, 0.002], [0.012, 0.03, 0.02], SKIN2))
  add('คอ', new THREE.CylinderGeometry(1, 1, 1, 20), [0, 1.452, 0], [0.045, 0.09, 0.045])

  // —— 躯干 ——
  add('หน้าอก', front(), [0, 1.27, 0], [0.19, 0.15, 0.115])
  add('หลัง', back(), [0, 1.17, 0], [0.19, 0.27, 0.11], SKIN2)
  add('ท้อง', front(), [0, 1.06, 0], [0.168, 0.135, 0.108], 0xf0c29c)
  add('เอว', new THREE.CylinderGeometry(1, 1, 1, 28), [0, 0.965, 0], [0.16, 0.05, 0.105], 0xe2ad85)
  add('หัวใจ', sph(), [0.062, 1.292, 0.1], [0.028, 0.03, 0.02], 0xe0344b)
  add(null, front(), [0, 0.88, 0], [0.178, 0.12, 0.108], 0x5b79c9)                       // 短裤（前）
  both(s => add('ก้น', sph(), [0.075 * s, 0.875, -0.045], [0.095, 0.105, 0.085], 0x4f6cba))

  // —— 手臂 ——
  both(s => {
    add('ไหล่', sph(), [0.215 * s, 1.36, 0], [0.058, 0.058, 0.058], SKIN2)
    add('แขน', cap(0.042, 0.19), [0.236 * s, 1.205, 0], undefined, SKIN, [0, 0, 0.06 * s])
    add('ศอก', sph(), [0.243 * s, 1.062, 0], [0.043, 0.043, 0.043], SKIN2)
    add('แขน', cap(0.036, 0.17), [0.247 * s, 0.93, 0])
    add('ข้อมือ', sph(), [0.249 * s, 0.808, 0], [0.032, 0.028, 0.032], SKIN2)
    add('มือ', sph(), [0.25 * s, 0.748, 0], [0.02, 0.05, 0.038])
    for (let i = 0; i < 4; i++) {
      const z = -0.027 + i * 0.018
      add('นิ้วมือ', cap(0.0075, 0.04), [0.25 * s, 0.678, z], undefined, SKIN2)
      add('เล็บ', sph(12), [0.25 * s + 0.004 * s, 0.652, z], [0.006, 0.008, 0.007], 0xffe9e2)
    }
  })

  // —— 腿和脚 ——
  both(s => {
    add('ต้นขา', cap(0.072, 0.25), [0.09 * s, 0.665, 0])
    add('เข่า', sph(), [0.09 * s, 0.475, 0.012], [0.062, 0.062, 0.062], SKIN2)
    add('น่อง', cap(0.05, 0.25), [0.09 * s, 0.275, 0])
    add('น่อง', sph(), [0.09 * s, 0.33, -0.03], [0.05, 0.085, 0.05])
    add('ข้อเท้า', sph(), [0.09 * s, 0.085, 0], [0.04, 0.036, 0.04], SKIN2)
    add('เท้า', sph(), [0.09 * s, 0.036, 0.055], [0.045, 0.03, 0.08])
    add('นิ้วเท้า', sph(), [0.09 * s, 0.026, 0.138], [0.044, 0.02, 0.026], 0xf7d6bd)
    add('ส้นเท้า', sph(), [0.09 * s, 0.036, -0.032], [0.036, 0.034, 0.036], SKIN2)
  })
  return { root, mats, centers }
}

export default function Body3D({ selected, onPick, zoom, onFail }: Body3DProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const api = useRef<{ select: (k: string | null, face: boolean) => void; zoom: (z: 'body' | 'face') => void } | null>(null)
  const pickRef = useRef(onPick); pickRef.current = onPick
  const fromCanvas = useRef(false)

  useEffect(() => {
    const el = wrap.current!; let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) } catch { onFail?.(); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 20)
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c4de, 1.15))
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(1.2, 2.4, 2.6); scene.add(sun)
    const rim = new THREE.DirectionalLight(0xbfd4ff, 0.7); rim.position.set(-1.5, 1.5, -2); scene.add(rim)
    const { root, mats } = buildBody(); scene.add(root)
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), new THREE.MeshBasicMaterial({ color: 0x1f3a6e, transparent: true, opacity: 0.1 }))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; scene.add(shadow)

    const VIEW = { body: { y: 0.88, d: 3.55 }, face: { y: 1.585, d: 0.98 } }
    let goal = { ...VIEW.body }, view = { ...VIEW.body }
    let rotY = 0.45, rotX = 0, goalY: number | null = null, auto = true, sel: string | null = null, t0 = performance.now()
    const size = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix() }
    const ro = new ResizeObserver(size); ro.observe(el); size()

    const paint = () => { for (const [k, ms] of mats) for (const m of ms) { m.emissive.setHex(k === sel ? HI : 0x000000); m.emissiveIntensity = k === sel ? 0.55 : 0 } }
    api.current = {
      select: (k, turn) => {
        sel = k; paint(); el.dataset.selected = k ?? ''
        if (k && turn) { goalY = BACK_KEYS.has(k) ? Math.PI : k === 'หู' ? 1.0 : 0.3; auto = false }   // 从词条点的：把这个部位转到镜头前（后背/屁股/脚后跟要转到背面）
      },
      zoom: z => { goal = { ...VIEW[z] } },
    }

    // 拖动旋转；几乎没动就算「点」，用射线找到点中的部位
    const ray = new THREE.Raycaster(); let down: { x: number; y: number; ry: number; rx: number; moved: boolean } | null = null
    const cv = renderer.domElement
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, ry: rotY, rx: rotX, moved: false }; cv.setPointerCapture?.(e.pointerId); auto = false; goalY = null }
    const onMove = (e: PointerEvent) => { if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.hypot(dx, dy) > 6) down.moved = true; if (down.moved) { rotY = down.ry + dx * 0.011; rotX = Math.max(-0.5, Math.min(0.5, down.rx + dy * 0.006)) } }
    const onUp = (e: PointerEvent) => {
      const d = down; down = null; if (!d || d.moved) return
      const r = cv.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam)
      const hit = ray.intersectObjects(root.children, false).find(h => h.object.userData.key)
      if (hit) { fromCanvas.current = true; pickRef.current(hit.object.userData.key as string) }
    }
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', () => { down = null })

    let raf = 0
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - t0) / 1000); t0 = t
      if (auto) rotY += dt * 0.35
      if (goalY !== null) { let d = goalY - rotY; d = Math.atan2(Math.sin(d), Math.cos(d)); rotY += d * Math.min(1, dt * 6); if (Math.abs(d) < 0.01) goalY = null }
      view.y += (goal.y - view.y) * Math.min(1, dt * 5); view.d += (goal.d - view.d) * Math.min(1, dt * 5)
      root.rotation.set(rotX, rotY, 0)
      const pulse = 1 + 0.07 * Math.sin(t / 170)
      for (const o of root.children) { const b = o.userData.base as [number, number, number] | undefined; if (b) { const k = o.userData.key === sel ? pulse : 1; o.scale.set(b[0] * k, b[1] * k, b[2] * k) } }
      cam.position.set(0, view.y + 0.05, view.d); cam.lookAt(0, view.y, 0)
      renderer.render(scene, cam); raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick); el.dataset.ready = '1'
    return () => { cancelAnimationFrame(raf); ro.disconnect(); api.current = null; renderer.dispose(); root.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose() }); cv.remove() }
  }, [])

  useEffect(() => { api.current?.select(selected, !fromCanvas.current); fromCanvas.current = false }, [selected])
  useEffect(() => { api.current?.zoom(zoom) }, [zoom])
  return <div ref={wrap} className="body3d" data-testid="body3d" />
}

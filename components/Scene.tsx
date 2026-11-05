"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = THREE.MathUtils.lerp;
const PI = Math.PI;

const CREAM = "#f2ece2";
const WALL = "#e8dfd0";
const BRASS = "#b08d57";

// Repeatable random numbers, so textures look the same every visit
function rand(seed: number) {
  let s = Math.max(1, Math.floor(seed));
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ---------- Textures drawn in code (no downloads needed) ---------- */

// Polished walnut floor planks
function makeFloorTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  const r = rand(7);
  const plankW = 128;
  for (let x = 0; x < 1024; x += plankW) {
    let y = -Math.floor(r() * 600);
    while (y < 1024) {
      const len = 520 + r() * 500;
      g.fillStyle = `hsl(${17 + r() * 6}, ${42 + r() * 10}%, ${24 + r() * 12}%)`;
      g.fillRect(x, y, plankW, len);
      for (let i = 0; i < 46; i++) {
        g.strokeStyle = `rgba(25,12,4,${0.04 + r() * 0.12})`;
        g.lineWidth = 0.8 + r() * 2;
        const gx = x + r() * plankW;
        g.beginPath();
        g.moveTo(gx, y);
        g.bezierCurveTo(gx + r() * 10 - 5, y + len / 3, gx + r() * 10 - 5, y + (2 * len) / 3, gx, y + len);
        g.stroke();
      }
      g.fillStyle = "rgba(12,6,2,0.85)";
      g.fillRect(x, y + len - 2, plankW, 2);
      y += len;
    }
    g.fillStyle = "rgba(12,6,2,0.9)";
    g.fillRect(x, 0, 2, 1024);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 10);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

// Very soft plaster grain for walls, pillar and partitions
function makePlasterTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const r = rand(21);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 110 + Math.floor(r() * 40);
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    const s = 1 + r() * 3;
    g.fillRect(r() * 512, r() * 512, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 3);
  return t;
}

// Fluted walnut for the reception desk
function makeDeskTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  const r = rand(3);
  g.fillStyle = "#6a3f24";
  g.fillRect(0, 0, 1024, 512);
  const flute = 28;
  for (let x = 0; x < 1024; x += flute) {
    const grad = g.createLinearGradient(x, 0, x + flute, 0);
    grad.addColorStop(0, "rgba(25,12,4,0.5)");
    grad.addColorStop(0.35, "rgba(255,215,170,0.14)");
    grad.addColorStop(0.7, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(25,12,4,0.55)");
    g.fillStyle = grad;
    g.fillRect(x, 0, flute, 512);
  }
  for (let i = 0; i < 400; i++) {
    g.strokeStyle = `rgba(35,18,8,${0.04 + r() * 0.1})`;
    const x = r() * 1024;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + r() * 6 - 3, 512);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Glowing gold "CARPET DIEM" lettering for the pillar
function makeTitleTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = '500 150px Georgia, "Times New Roman", serif';
  g.shadowColor = "rgba(255,205,135,0.95)";
  g.shadowBlur = 46;
  g.fillStyle = "#d1a865";
  g.fillText("CARPET", 512, 165);
  g.fillText("DIEM", 512, 345);
  g.shadowBlur = 0;
  g.fillStyle = "#c79d5d";
  g.fillText("CARPET", 512, 165);
  g.fillText("DIEM", 512, 345);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Cream fringe along the bottom of each carpet
function makeFringeTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 64;
  const g = c.getContext("2d")!;
  const r = rand(9);
  for (let x = 2; x < 512; x += 5) {
    g.strokeStyle = `rgba(238,226,204,${0.75 + r() * 0.25})`;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + r() * 3 - 1.5, 40 + r() * 22);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A plain, clearly-marked placeholder until you add your own carpet photo
function makePlaceholder(seed: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 768;
  const g = c.getContext("2d")!;
  const r = rand(seed + 11);
  const hue = 20 + r() * 14;
  g.fillStyle = `hsl(${hue}, 24%, 46%)`;
  g.fillRect(0, 0, 512, 768);
  // woven texture
  for (let y = 0; y < 768; y += 3) {
    g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
    g.fillRect(0, y, 512, 1);
  }
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(255,240,220,${r() * 0.06})`;
    g.fillRect(r() * 512, r() * 768, 2, 2);
  }
  g.strokeStyle = `hsla(${hue}, 25%, 78%, 0.55)`;
  g.lineWidth = 16;
  g.strokeRect(30, 30, 452, 708);
  g.lineWidth = 3;
  g.strokeRect(66, 66, 380, 636);
  g.fillStyle = `hsla(${hue}, 20%, 88%, 0.7)`;
  g.font = "600 17px Arial, sans-serif";
  g.textAlign = "center";
  g.fillText("PHOTO NEEDED", 256, 732);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Loads your photo; shows the placeholder until it exists ---------- */
function usePhoto(url: string, seed: number) {
  const placeholder = useMemo(() => makePlaceholder(seed), [seed]);
  const [tex, setTex] = useState<THREE.Texture>(placeholder);
  useEffect(() => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 16;
        setTex(t);
      },
      undefined,
      () => setTex(placeholder)
    );
  }, [url, placeholder]);
  return tex;
}

// A carpet surface with a very gentle natural hang (not perfectly flat)
function useClothGeometry(w: number, h: number) {
  return useMemo(() => {
    const geo = new THREE.PlaneGeometry(w, h, 30, 44);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const down = (h / 2 - y) / h; // 0 at the rod, 1 at the bottom
      const wave = Math.sin((x / w) * PI * 3.2 + 0.6) * 0.012 * (0.3 + down);
      pos.setZ(i, wave);
    }
    geo.computeVertexNormals();
    return geo;
  }, [w, h]);
}

/* ================================================================== */
/*  Gallery pieces                                                     */
/* ================================================================== */

function HangingCarpet({
  src,
  seed,
  z,
  fringe,
}: {
  src: string;
  seed: number;
  z: number;
  fringe: THREE.Texture;
}) {
  const tex = usePhoto(src, seed);
  const w = 1.8;
  const h = 2.7;
  const geo = useClothGeometry(w, h);
  const dir = Math.sign(z);
  return (
    <group position={[0, 0.1, z]} rotation={[0, dir < 0 ? PI : 0, 0]}>
      {/* brass rod with round finials */}
      <mesh position={[0, h / 2 + 0.07, 0.05]} rotation={[0, 0, PI / 2]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, w + 0.4, 16]} />
        <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.28} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + 0.22), h / 2 + 0.07, 0.05]} castShadow>
          <sphereGeometry args={[0.038, 16, 16]} />
          <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.28} />
        </mesh>
      ))}
      {/* rod rings */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-w / 2 + (i * w) / 8, h / 2 + 0.035, 0.05]}>
          <torusGeometry args={[0.03, 0.006, 6, 14]} />
          <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      {/* the carpet itself — your photo also gives it a woven relief */}
      <mesh geometry={geo} position={[0, 0, 0.035]} castShadow receiveShadow>
        <meshStandardMaterial map={tex} bumpMap={tex} bumpScale={0.8} roughness={0.97} />
      </mesh>
      {/* fringe */}
      <mesh position={[0, -h / 2 - 0.045, 0.04]}>
        <planeGeometry args={[w * 0.98, 0.09]} />
        <meshStandardMaterial map={fringe} transparent alphaTest={0.2} roughness={1} />
      </mesh>
    </group>
  );
}

// Free-standing cream partition with a slim brass frame, a carpet on each face
function Partition({
  pos,
  front,
  back,
  seed,
  plaster,
  fringe,
}: {
  pos: [number, number, number];
  front: string;
  back: string;
  seed: number;
  plaster: THREE.Texture;
  fringe: THREE.Texture;
}) {
  const W = 2.6;
  const H = 4.2;
  const D = 0.16;
  return (
    <group position={pos}>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={CREAM} roughness={0.92} bumpMap={plaster} bumpScale={0.15} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 + 0.02), H / 2, 0]} castShadow>
          <boxGeometry args={[0.04, H + 0.02, D + 0.02]} />
          <meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.32} />
        </mesh>
      ))}
      <mesh position={[0, H + 0.02, 0]} castShadow>
        <boxGeometry args={[W + 0.08, 0.04, D + 0.02]} />
        <meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.32} />
      </mesh>
      {/* slim plinth so it sits on the floor */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[W + 0.08, 0.06, D + 0.06]} />
        <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.4} />
      </mesh>
      <group position={[0, H / 2 + 0.05, 0]}>
        <HangingCarpet src={front} seed={seed} z={D / 2 + 0.005} fringe={fringe} />
        <HangingCarpet src={back} seed={seed + 50} z={-(D / 2 + 0.005)} fringe={fringe} />
      </group>
    </group>
  );
}

// Ceiling track spotlight that washes one carpet
function TrackSpot({ pos, aim }: { pos: [number, number, number]; aim: [number, number, number] }) {
  const ref = useRef<THREE.SpotLight>(null!);
  const { scene } = useThree();
  useEffect(() => {
    const t = ref.current.target;
    t.position.set(...aim);
    scene.add(t);
    return () => {
      scene.remove(t);
    };
  }, [aim, scene]);
  return (
    <group>
      <spotLight
        ref={ref}
        position={pos}
        angle={0.36}
        penumbra={0.85}
        intensity={26}
        distance={11}
        decay={2}
        color="#ffd9a6"
      />
      <mesh position={[pos[0], pos[1] + 0.06, pos[2]]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.16, 16]} />
        <meshStandardMaterial color="#151210" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 1.07, z]}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <sphereGeometry args={[0.12, 24, 18]} />
        <meshStandardMaterial color="#a7834b" metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.39, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.2, 8]} />
        <meshStandardMaterial color="#a7834b" metalness={0.9} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.22, 32, 12, 0, PI * 2, 0, PI / 2]} />
        <meshStandardMaterial color="#c4a067" metalness={0.75} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* warm bulb glow under the shade */}
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.42, 0]} intensity={3} distance={4} decay={2} color="#ffc27a" />
    </group>
  );
}

function Frond({ len, tilt }: { len: number; tilt: number }) {
  return (
    <mesh
      rotation={[tilt, 0, 0]}
      position={[0, -Math.sin(tilt) * len * 0.3, len * 0.45]}
      scale={[0.1, 0.012, len / 2]}
      castShadow
    >
      <sphereGeometry args={[1, 12, 6]} />
      <meshStandardMaterial color="#4f6039" roughness={0.75} />
    </mesh>
  );
}

function PalmPlant({ pos, s = 1 }: { pos: [number, number, number]; s?: number }) {
  const fronds = useMemo(() => {
    const r = rand(Math.abs(Math.round(pos[0] * 100 + pos[2] * 10)) + 5);
    return Array.from({ length: 22 }, (_, i) => ({
      a: (i / 22) * PI * 2 + r() * 0.3,
      tilt: 0.3 + r() * 0.85,
      len: 0.6 + r() * 0.45,
      y: 0.85 + r() * 0.6,
    }));
  }, [pos]);
  return (
    <group position={pos} scale={s}>
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.2, 0.48, 32]} />
        <meshStandardMaterial color="#a68c63" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 1.0, 6]} />
        <meshStandardMaterial color="#5b4a2e" />
      </mesh>
      {fronds.map((f, i) => (
        <group key={i} position={[0, f.y, 0]} rotation={[0, f.a, 0]}>
          <Frond len={f.len} tilt={f.tilt} />
        </group>
      ))}
    </group>
  );
}

function Basket({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={[pos[0], 0, pos[2]]}>
      <mesh position={[0, 0.27, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.23, 0.54, 32]} />
        <meshStandardMaterial color="#b8996a" roughness={1} />
      </mesh>
      {[0.12, 0.27, 0.42].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[0.25, 0.008, 6, 32]} />
          <meshStandardMaterial color="#8f7550" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Bench({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.08, 0.6]} />
        <meshStandardMaterial color="#5e3a22" roughness={0.45} />
      </mesh>
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]} castShadow>
          <boxGeometry args={[0.08, 0.4, 0.5]} />
          <meshStandardMaterial color="#4a2c18" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  The gallery room — wider and taller so it feels spacious           */
/* ================================================================== */

const ROOM = { left: -10, right: 10, back: -24, front: 8, h: 5.6 };
const PANEL_X = 4.8;
const PANEL_Z = [0, -4.4, -8.8, -13.2, -17.6];

// memo: the room is built once and not rebuilt on every scroll frame
const Gallery = memo(function Gallery({ mobile }: { mobile: boolean }) {
  const floorTex = useMemo(() => makeFloorTexture(), []);
  const plaster = useMemo(() => makePlasterTexture(), []);
  const deskTex = useMemo(() => makeDeskTexture(), []);
  const titleTex = useMemo(() => makeTitleTexture(), []);
  const fringe = useMemo(() => makeFringeTexture(), []);

  const W = ROOM.right - ROOM.left;
  const L = ROOM.front - ROOM.back;
  const midZ = (ROOM.front + ROOM.back) / 2;
  const wallMat = <meshStandardMaterial color={WALL} roughness={0.95} bumpMap={plaster} bumpScale={0.12} />;

  return (
    <group>
      {/* ---------- Light ---------- */}
      <ambientLight intensity={0.12} color="#fff1dd" />
      <hemisphereLight args={["#fff2df", "#4a2e1a", 0.35]} />
      <directionalLight
        position={[4, 12, 8]}
        intensity={0.8}
        color="#ffe9cc"
        castShadow
        shadow-mapSize={[mobile ? 1024 : 2048, mobile ? 1024 : 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-far={50}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      {[4, -2, -8, -14, -20].map((z) => (
        <pointLight key={z} position={[0, ROOM.h - 0.4, z]} intensity={18} distance={14} decay={2} color="#ffdcae" />
      ))}
      {/* warm wash on the pillar sign */}
      <pointLight position={[0, 4.2, -3.6]} intensity={9} distance={5} decay={2} color="#ffd59a" />

      {/* gallery spotlights on every front-facing carpet (desktop only, for speed) */}
      {!mobile &&
        PANEL_Z.flatMap((z, i) =>
          [-1, 1].map((s) => (
            <TrackSpot
              key={`${s}${i}`}
              pos={[s * (PANEL_X - 1.6), ROOM.h - 0.15, z + 2.6]}
              aim={[s * PANEL_X, 2.3, z]}
            />
          ))
        )}

      {/* ---------- Floor ---------- */}
      <mesh rotation-x={-PI / 2} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[W, L]} />
        {mobile ? (
          <meshStandardMaterial map={floorTex} roughness={0.32} metalness={0.05} />
        ) : (
          <MeshReflectorMaterial
            map={floorTex}
            blur={[500, 140]}
            resolution={1024}
            mixBlur={1}
            mixStrength={1.6}
            roughness={0.5}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            metalness={0.05}
            mirror={0.55}
          />
        )}
      </mesh>

      {/* ---------- Ceiling with black linear light channels ---------- */}
      <mesh rotation-x={PI / 2} position={[0, ROOM.h, midZ]}>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial color="#f1ebe1" roughness={1} />
      </mesh>
      {[-7.2, -3.2, 3.2, 7.2].map((x) => (
        <group key={x}>
          <mesh position={[x, ROOM.h - 0.012, midZ]}>
            <boxGeometry args={[0.1, 0.024, L - 0.6]} />
            <meshStandardMaterial color="#121010" roughness={0.6} />
          </mesh>
          {Array.from({ length: 13 }, (_, i) => (
            <mesh key={i} position={[x, ROOM.h - 0.03, ROOM.front - 1.2 - i * 2.4]} rotation-x={PI / 2}>
              <circleGeometry args={[0.035, 12]} />
              <meshBasicMaterial color="#fff2d2" toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ---------- Four walls with skirting ---------- */}
      <mesh position={[0, ROOM.h / 2, ROOM.back]} receiveShadow>
        <planeGeometry args={[W, ROOM.h]} />
        {wallMat}
      </mesh>
      <mesh position={[0, ROOM.h / 2, ROOM.front]} rotation-y={PI} receiveShadow>
        <planeGeometry args={[W, ROOM.h]} />
        {wallMat}
      </mesh>
      <mesh position={[ROOM.right, ROOM.h / 2, midZ]} rotation-y={-PI / 2} receiveShadow>
        <planeGeometry args={[L, ROOM.h]} />
        {wallMat}
      </mesh>
      <mesh position={[ROOM.left, ROOM.h / 2, midZ]} rotation-y={PI / 2} receiveShadow>
        <planeGeometry args={[L, ROOM.h]} />
        {wallMat}
      </mesh>
      {[
        { p: [0, 0.06, ROOM.back + 0.02] as [number, number, number], s: [W, 0.12, 0.04] as [number, number, number] },
        { p: [0, 0.06, ROOM.front - 0.02] as [number, number, number], s: [W, 0.12, 0.04] as [number, number, number] },
        { p: [ROOM.right - 0.02, 0.06, midZ] as [number, number, number], s: [0.04, 0.12, L] as [number, number, number] },
        { p: [ROOM.left + 0.02, 0.06, midZ] as [number, number, number], s: [0.04, 0.12, L] as [number, number, number] },
      ].map((b, i) => (
        <mesh key={i} position={b.p}>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color="#d9ccb7" roughness={0.8} />
        </mesh>
      ))}

      {/* ---------- Central pillar with the brand name ---------- */}
      <mesh position={[0, ROOM.h / 2, -6]} castShadow receiveShadow>
        <boxGeometry args={[2.6, ROOM.h, 1.6]} />
        <meshStandardMaterial color="#f3eee6" roughness={0.93} bumpMap={plaster} bumpScale={0.1} />
      </mesh>
      <mesh position={[0.05, 3.55, -5.19]}>
        <planeGeometry args={[2.1, 1.05]} />
        <meshBasicMaterial map={titleTex} transparent toneMapped={false} />
      </mesh>

      {/* ---------- Reception desk (fluted walnut) ---------- */}
      <group position={[0, 0, -4.3]}>
        <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 1.04, 0.9]} />
          <meshStandardMaterial attach="material-0" color="#5a361f" roughness={0.45} />
          <meshStandardMaterial attach="material-1" color="#5a361f" roughness={0.45} />
          <meshStandardMaterial attach="material-2" color="#5a361f" roughness={0.45} />
          <meshStandardMaterial attach="material-3" color="#5a361f" roughness={0.45} />
          <meshStandardMaterial attach="material-4" map={deskTex} bumpMap={deskTex} bumpScale={1.5} roughness={0.42} />
          <meshStandardMaterial attach="material-5" color="#5a361f" roughness={0.45} />
        </mesh>
        <mesh position={[0, 1.065, 0]} castShadow>
          <boxGeometry args={[3.34, 0.05, 1.0]} />
          <meshStandardMaterial color="#3f2614" roughness={0.18} metalness={0.05} />
        </mesh>
        <mesh position={[0.45, 1.1, 0.05]}>
          <boxGeometry args={[0.6, 0.02, 0.36]} />
          <meshStandardMaterial color="#2a1a10" roughness={0.6} />
        </mesh>
      </group>
      <Lamp x={-1.0} z={-4.35} />
      <Lamp x={-0.4} z={-4.4} />

      {/* ---------- Plants, baskets, bench ---------- */}
      <PalmPlant pos={[1.15, 0, -4.95]} s={1.35} />
      <PalmPlant pos={[-8.9, 0, 6.6]} s={1.4} />
      <PalmPlant pos={[8.9, 0, 6.6]} s={1.4} />
      <PalmPlant pos={[-9, 0, -22.6]} s={1.3} />
      <PalmPlant pos={[9, 0, -22.6]} s={1.3} />
      <Basket pos={[-3.2, 0, -2.1]} />
      <Basket pos={[6.7, 0, -3.4]} />
      <Basket pos={[-6.7, 0, -7.8]} />
      <Basket pos={[3.4, 0, -15.4]} />
      <Bench z={-12.5} />

      {/* ---------- Partitions down both sides ---------- */}
      {PANEL_Z.map((z, i) => (
        <Partition
          key={`L${i}`}
          pos={[-PANEL_X, 0, z]}
          front={`/carpets/${i * 2 + 1}.jpg`}
          back={`/carpets/${i * 2 + 11}.jpg`}
          seed={i * 2 + 1}
          plaster={plaster}
          fringe={fringe}
        />
      ))}
      {PANEL_Z.map((z, i) => (
        <Partition
          key={`R${i}`}
          pos={[PANEL_X, 0, z]}
          front={i === 0 ? "/carpets/featured.jpg" : `/carpets/${i * 2 + 2}.jpg`}
          back={`/carpets/${i * 2 + 12}.jpg`}
          seed={i * 2 + 2}
          plaster={plaster}
          fringe={fringe}
        />
      ))}

      {/* ---------- Soft reflections on brass and polished wood ---------- */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={1.6} color="#ffe3bd" position={[0, 6, -8]} rotation-x={PI / 2} scale={[14, 30, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#f3e6d2" position={[-10, 2.5, -8]} rotation-y={PI / 2} scale={[30, 5, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#f3e6d2" position={[10, 2.5, -8]} rotation-y={-PI / 2} scale={[30, 5, 1]} />
        <Lightformer form="rect" intensity={0.4} color="#e9dccb" position={[0, 2.5, 8]} rotation-y={PI} scale={[20, 5, 1]} />
      </Environment>
    </group>
  );
});

/* ================================================================== */
/*  The featured carpet, isolated and turning                          */
/* ================================================================== */

function FeaturedCarpet({ spin }: { spin: number }) {
  const tex = usePhoto("/carpets/featured.jpg", 2);
  const fringe = useMemo(() => makeFringeTexture(), []);
  const w = 2.4;
  const h = 3.6;
  // Only the front shows your photo. The back stays a plain woven colour
  // because the reverse side has not been photographed.
  return (
    <group rotation={[0.03, spin, 0]}>
      <mesh castShadow>
        <boxGeometry args={[w, h, 0.045]} />
        <meshStandardMaterial attach="material-0" color="#9c8467" roughness={1} />
        <meshStandardMaterial attach="material-1" color="#9c8467" roughness={1} />
        <meshStandardMaterial attach="material-2" color="#9c8467" roughness={1} />
        <meshStandardMaterial attach="material-3" color="#9c8467" roughness={1} />
        <meshStandardMaterial attach="material-4" map={tex} bumpMap={tex} bumpScale={0.8} roughness={0.96} />
        <meshStandardMaterial attach="material-5" color="#b3a088" roughness={1} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * (h / 2 + 0.05), 0]} rotation={[0, 0, s < 0 ? 0 : PI]}>
          <planeGeometry args={[w * 0.98, 0.1]} />
          <meshStandardMaterial map={fringe} transparent alphaTest={0.2} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Camera path   [progress, x, z, turn]                               */
/*  turn 0 = facing the pillar, 2π = one full circle                   */
/* ================================================================== */

const AISLE = 2.55;
const KEYS: [number, number, number, number][] = [
  [0.0, 0, 5.4, 0],
  [0.08, 0, 4.6, 0], // matches the landing picture
  [0.18, AISLE, 1.0, 0.06], // step into the right-hand aisle
  [0.3, AISLE, -11, 0.06], // walk deep into the gallery
  [0.44, AISLE, -11, 0.06 + 2 * PI], // full 360° look around
  [0.52, AISLE, -11, 3 * PI], // turn towards the entrance
  [0.6, AISLE, 4.4, 3 * PI], // walk back to the front
  [0.65, PANEL_X, 4.8, 4 * PI], // turn to face the featured carpet
  [0.7, PANEL_X, 2.7, 4 * PI], // approach it
];

function cameraAt(p: number): [number, number, number, number] {
  if (p <= KEYS[0][0]) return KEYS[0];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (p <= b[0]) {
      const t = ease((p - a[0]) / (b[0] - a[0]));
      return [p, lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    }
  }
  return KEYS[KEYS.length - 1];
}

/* ================================================================== */
/*  Scene                                                              */
/* ================================================================== */

export default function Scene({ progress: p }: { progress: number }) {
  const { camera, size } = useThree();
  const portrait = size.width < size.height;
  const mobile = size.width < 768;
  const inGallery = p < 0.7;

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const fov = portrait ? 72 : 58;
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    if (inGallery) {
      const [, x, z, turn] = cameraAt(p);
      cam.position.set(x, 1.65, z);
      cam.rotation.set(0, turn, 0);
    } else {
      cam.position.set(0, 0, 7);
      cam.rotation.set(0, 0, 0);
    }
  });

  const spin = ease(seg(p, 0.76, 0.93)) * PI * 2;
  const settle = ease(seg(p, 0.93, 0.96));
  // On desktop the carpet sits left so the story can sit on the right
  const narrow = portrait || size.width < 900;
  const carpetX = narrow ? 0 : -1.7;
  const carpetY = narrow ? 0.8 : 0;

  return (
    <>
      <color attach="background" args={["#e9dfcf"]} />
      {inGallery ? <Gallery mobile={mobile} /> : null}
      {!inGallery ? (
        <group>
          <ambientLight intensity={0.35} color="#fff1dd" />
          <hemisphereLight args={["#fff4e6", "#cbb89a", 0.6]} />
          <directionalLight
            position={[3, 5, 7]}
            intensity={2.2}
            color="#ffe6c4"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-6}
            shadow-camera-right={6}
            shadow-camera-top={6}
            shadow-camera-bottom={-6}
          />
          <directionalLight position={[-5, 1, 4]} intensity={0.6} color="#f0e2cc" />
          {/* beige backdrop that catches the carpet's soft shadow */}
          <mesh position={[0, 0, -2.2]} receiveShadow>
            <planeGeometry args={[60, 40]} />
            <meshStandardMaterial color="#e9dfcf" roughness={1} />
          </mesh>
          <group
            position={[lerp(carpetX, 0, settle), lerp(carpetY, 0.25, settle), 0]}
            scale={narrow ? 0.95 : 1.05}
          >
            <FeaturedCarpet spin={spin} />
          </group>
        </group>
      ) : null}
    </>
  );
}
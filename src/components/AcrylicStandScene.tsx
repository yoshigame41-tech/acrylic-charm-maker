import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Lightformer,
  ContactShadows,
  Float,
  useTexture,
} from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { buildSilhouetteShape } from "@/lib/silhouetteShape";

type Props = {
  imageUrl: string;
  aspect: number; // width / height
  thickness: number;
  tint: number; // 0..1 edge tint strength
  nameText?: string | undefined;
};

function Figure({ imageUrl, aspect, thickness, tint }: Props) {
  console.log("FIGURE render", imageUrl);
  const texture = useTexture(imageUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  // 裏面用: 表のシルエットを真っ白に塗りつぶしたテクスチャ
  const silhouette = useMemo(() => {
    const img = texture.image as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!img || typeof document === "undefined") return null;
    const w = (img as HTMLImageElement).width || 512;
    const h = (img as HTMLImageElement).height || 512;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [texture]);

  const height = 2.6;
  const width = height * aspect;
  const margin = 0.16;
  const boardW = width + margin * 2;
  const boardH = height + margin * 2;
  const tabH = 0.34;

  // シルエットに沿った輪郭（外側に余白を付けた形）
  const silhouetteOutline = useMemo(() => {
    const img = texture.image as HTMLImageElement | undefined;
    if (!img) return null;
    try {
      const r = buildSilhouetteShape(img, width, height, margin);
      console.log('SIL', r && { centerY: r.centerY, boardH: r.boardH, boardW: r.boardW, pts: r.shape.getPoints(4).length });
      return r;
    } catch {
      return null;
    }
  }, [texture, width, height, margin]);

  const fallbackShape = useMemo(() => {
    const s = new THREE.Shape();
    const w = boardW / 2;
    const h = boardH;
    const r = 0.14;
    s.moveTo(-w + r, 0);
    s.lineTo(w - r, 0);
    s.quadraticCurveTo(w, 0, w, r);
    s.lineTo(w, h - r);
    s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h);
    s.quadraticCurveTo(-w, h, -w, h - r);
    s.lineTo(-w, r);
    s.quadraticCurveTo(-w, 0, -w + r, 0);
    return s;
  }, [boardW, boardH]);

  const shape = silhouetteOutline?.shape ?? fallbackShape;
  const artCenterY = silhouetteOutline?.centerY ?? boardH / 2;

  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSize: thickness * 0.18,
      bevelThickness: thickness * 0.18,
      bevelSegments: 3,
      curveSegments: 24,
    });
    g.translate(0, 0, -thickness / 2);
    return g;
  }, [shape, thickness]);

  return (
    <group position={[0, tabH * 0.5, 0]}>
      {/* Acrylic board */}
      <mesh geometry={geometry} castShadow>
        <meshPhysicalMaterial
          transmission={0.94}
          thickness={thickness * 5}
          roughness={0.05}
          metalness={0}
          ior={1.5}
          clearcoat={1}
          clearcoatRoughness={0.03}
          transparent
          opacity={0.85}
          envMapIntensity={2.4}
          attenuationDistance={2}
          attenuationColor={"#bfe6ff"}
          specularIntensity={1}
        />
      </mesh>

      {/* Glowing acrylic edge */}
      <mesh geometry={geometry} scale={[1.004, 1.002, 1.02]}>
        <meshBasicMaterial
          color="#a8ecff"
          transparent
          opacity={0.1 + 0.14 * tint}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Printed artwork, front and back */}
      {[1, -1].map((side) => (
        <mesh
          key={side}
          position={[0, artCenterY, side * (thickness / 2 + thickness * 0.18 + 0.006)]}
          rotation={[0, side === 1 ? 0 : Math.PI, 0]}
        >
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            map={side === 1 ? texture : (silhouette ?? texture)}
            color={side === 1 ? "#ffffff" : "#ffffff"}
            transparent
            alphaTest={0.05}
            toneMapped={false}
            side={THREE.FrontSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function useNameTexture(nameText?: string) {
  return useMemo(() => {
    const text = (nameText ?? "").trim();
    if (!text || typeof document === "undefined") return null;
    const w = 1024;
    const h = 256;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, w, h);
    let size = 150;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    do {
      ctx.font = `600 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      if (ctx.measureText(text).width <= w * 0.86) break;
      size -= 6;
    } while (size > 24);
    ctx.shadowColor = "rgba(160, 235, 255, 0.9)";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "#eaf9ff";
    ctx.fillText(text, w / 2, h / 2);
    ctx.shadowBlur = 0;
    ctx.fillText(text, w / 2, h / 2);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [nameText]);
}

function Base({ thickness, nameText }: { thickness: number; nameText?: string | undefined }) {
  const nameTexture = useNameTexture(nameText);
  return (
    <group>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.15, 1.25, 0.18, 64]} />
        <meshPhysicalMaterial
          transmission={0.92}
          thickness={0.7}
          roughness={0.07}
          ior={1.5}
          clearcoat={1}
          transparent
          opacity={0.85}
          envMapIntensity={2.4}
          attenuationDistance={1.4}
          attenuationColor={"#bfe9ff"}
        />
      </mesh>
      {/* slot shadow line */}
      <mesh position={[0, 0.185, 0]}>
        <boxGeometry args={[1.4, 0.01, thickness * 1.2]} />
        <meshBasicMaterial color="#0b1220" opacity={0.45} transparent />
      </mesh>

      {/* 台座の名入れ（上面・手前側） */}
      {nameTexture && (
        <mesh position={[0, 0.181, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.7, 0.425]} />
          <meshBasicMaterial
            map={nameTexture}
            transparent
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

export default function AcrylicStandScene({
  imageUrl,
  aspect,
  thickness,
  tint,
  nameText,
}: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 2.2, 6.2], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#151f38"]} />
      <fog attach="fog" args={["#151f38", 11, 26]} />

      <ambientLight intensity={0.8} />
      <directionalLight
        position={[4, 6, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 2, -4]} intensity={1.2} color="#7dd3fc" />
      <pointLight position={[0, 0.6, 3]} intensity={6 * tint} color="#a5f3fc" />

      <Suspense fallback={null}>
        <Float speed={1.2} rotationIntensity={0.12} floatIntensity={0.18}>
          <group position={[0, -1.5, 0]}>
            <Figure imageUrl={imageUrl} aspect={aspect} thickness={thickness} tint={tint} />
            <Base thickness={thickness} nameText={nameText} />
          </group>
        </Float>
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={6} position={[0, 4, 3]} scale={[8, 4, 1]} color="#eaf6ff" />
          <Lightformer
            intensity={4}
            position={[-5, 1, 2]}
            rotation-y={Math.PI / 2}
            scale={[6, 6, 1]}
            color="#7dd3fc"
          />
          <Lightformer
            intensity={3}
            position={[5, 0, -2]}
            rotation-y={-Math.PI / 2}
            scale={[6, 6, 1]}
            color="#f0abfc"
          />
          <Lightformer intensity={2} position={[0, -3, 0]} scale={[8, 8, 1]} color="#94a3b8" />
          <Lightformer
            intensity={8}
            position={[-2, 2, 5]}
            rotation-z={Math.PI / 5}
            scale={[0.6, 8, 1]}
            color="#ffffff"
          />
          <Lightformer
            intensity={5}
            position={[2.5, -1, 5]}
            rotation-z={-Math.PI / 6}
            scale={[0.35, 6, 1]}
            color="#bae6fd"
          />
        </Environment>
      </Suspense>

      <ContactShadows
        position={[0, -1.52, 0]}
        opacity={0.55}
        scale={12}
        blur={2.6}
        far={5}
        color="#000000"
      />

      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={12}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 1.9}
        autoRotate
        autoRotateSpeed={0.6}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}

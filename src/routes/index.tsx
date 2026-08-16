import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Upload, Sparkles, RotateCcw, ImageIcon, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { removeBackground, loadRaw, type ProcessedImage } from "@/lib/removeBackground";

const AcrylicStandScene = lazy(() => import("@/components/AcrylicStandScene"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AcryStudio — 画像から3Dアクリルスタンドを作る" },
      {
        name: "description",
        content:
          "画像をアップロードするだけで、背景を自動で切り抜き、3Dのアクリルスタンド（アクスタ）としてリアルタイムに360度プレビューできるWebアプリ。",
      },
      { property: "og:title", content: "AcryStudio — 画像から3Dアクリルスタンドを作る" },
      {
        property: "og:description",
        content: "画像をドロップして、透明感のあるアクリルスタンドを3Dでプレビュー。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [image, setImage] = useState<ProcessedImage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cutout, setCutout] = useState(true);
  const [tolerance, setTolerance] = useState(14);
  const [thickness, setThickness] = useState(0.12);
  const [glow, setGlow] = useState(0.6);
  const [nameText, setNameText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const process = useCallback(
    async (f: File, useCutout: boolean, tol: number) => {
      setProcessing(true);
      try {
        const result = useCutout ? await removeBackground(f, tol / 100) : await loadRaw(f);
        setImage(result);
      } finally {
        setProcessing(false);
      }
    },
    [],
  );

  const handleFile = useCallback(
    (f: File | undefined | null) => {
      if (!f || !f.type.startsWith("image/")) return;
      setFile(f);
      void process(f, cutout, tolerance);
    },
    [cutout, tolerance, process],
  );

  useEffect(() => {
    if (!file) return;
    const t = setTimeout(() => void process(file, cutout, tolerance), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutout, tolerance]);

  const aspect = image ? image.width / image.height : 1;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-aurora opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.18]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-5 py-8 lg:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">AcryStudio</h1>
              <p className="text-xs text-muted-foreground">
                画像から3Dアクリルスタンドをつくる
              </p>
            </div>
          </div>
          <span className="hidden rounded-full border border-border bg-glass px-3 py-1 text-xs text-muted-foreground backdrop-blur-md sm:block">
            Prototype v0.1
          </span>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[360px_1fr]">
          {/* Control panel */}
          <aside className="flex flex-col gap-5 rounded-3xl border border-border bg-glass p-5 shadow-elegant backdrop-blur-xl">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => inputRef.current?.click()}
              className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                dragging
                  ? "border-primary bg-primary/10 shadow-glow"
                  : "border-border/80 hover:border-primary/60 hover:bg-primary/5"
              }`}
            >
              <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary transition-transform group-hover:scale-110">
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Upload className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">画像をドラッグ＆ドロップ</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  またはクリックしてファイルを選択（PNG / JPG）
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>

            <div className="space-y-5 rounded-2xl bg-secondary/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">背景を透過</p>
                  <p className="text-xs text-muted-foreground">四隅の色を基準に切り抜き</p>
                </div>
                <Switch checked={cutout} onCheckedChange={setCutout} />
              </div>

              <Control
                label="切り抜き強度"
                value={`${tolerance}%`}
                disabled={!cutout}
              >
                <Slider
                  value={[tolerance]}
                  min={2}
                  max={40}
                  step={1}
                  disabled={!cutout}
                  onValueChange={(v) => setTolerance(v[0] ?? 14)}
                />
              </Control>

              <Control label="アクリルの厚み" value={`${(thickness * 100).toFixed(0)}mm`}>
                <Slider
                  value={[thickness]}
                  min={0.04}
                  max={0.3}
                  step={0.01}
                  onValueChange={(v) => setThickness(v[0] ?? 0.12)}
                />
              </Control>

              <Control label="エッジの発光" value={glow.toFixed(1)}>
                <Slider
                  value={[glow]}
                  min={0}
                  max={2}
                  step={0.1}
                  onValueChange={(v) => setGlow(v[0] ?? 0.6)}
                />
              </Control>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium">台座の名入れ</span>
                  <span className="text-muted-foreground tabular-nums">
                    {nameText.length}/20
                  </span>
                </div>
                <Input
                  value={nameText}
                  maxLength={20}
                  placeholder="名前やメッセージを入力"
                  onChange={(e) => setNameText(e.target.value)}
                />
              </div>
            </div>

            {image && (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/30 p-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-checker">
                  <img
                    src={image.url}
                    alt="切り抜き後のプレビュー"
                    className="max-h-14 max-w-14 object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{file?.name ?? "image"}</p>
                  <p className="text-xs text-muted-foreground">
                    {image.width} × {image.height}px
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="リセット"
                  onClick={() => {
                    setImage(null);
                    setFile(null);
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            )}

            <p className="mt-auto text-xs leading-relaxed text-muted-foreground">
              ドラッグで回転、ホイールでズーム。単色背景の画像ほどきれいに切り抜けます。
            </p>
          </aside>

          {/* Viewer */}
          <section className="relative min-h-[60vh] overflow-hidden rounded-3xl border border-border bg-glass shadow-elegant backdrop-blur-xl">
            {mounted && image ? (
              <Suspense fallback={<ViewerPlaceholder loading />}>
                <AcrylicStandScene
                  key={image.url}
                  imageUrl={image.url}
                  aspect={aspect}
                  thickness={thickness}
                  tint={glow}
                  nameText={nameText}
                />
              </Suspense>
            ) : (
              <ViewerPlaceholder />
            )}
            {image && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-glass px-4 py-2 text-xs text-muted-foreground backdrop-blur-md">
                ドラッグで360°回転 ・ ホイールでズーム
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Control({
  label,
  value,
  disabled,
  children,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={disabled ? "opacity-40" : undefined}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

function ViewerPlaceholder({ loading }: { loading?: boolean }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-border bg-secondary/40">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium">
          {loading ? "3Dシーンを準備中…" : "まだアクスタがありません"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          左のパネルから画像をアップロードしてください
        </p>
      </div>
    </div>
  );
}

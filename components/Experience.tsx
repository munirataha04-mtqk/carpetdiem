"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Scene from "./Scene";

// Only write facts you are sure about. Replace the [brackets] with your real information.
const STORY = [
  { label: "Origin", text: "[Where this carpet comes from]" },
  { label: "Inspiration", text: "[What inspired its design]" },
  { label: "Craftsmanship", text: "[The technique and the materials]" },
  { label: "The making", text: "[How it was made, and how long it took]" },
  { label: "The meaning", text: "[What the design means]" },
];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export default function Experience() {
  const target = useRef(0);
  const smooth = useRef(0);
  const [p, setP] = useState(0);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) setWebgl(false);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target.current = max > 0 ? window.scrollY / max : 0;
    };

    let raf = 0;
    const loop = () => {
      const next = smooth.current + (target.current - smooth.current) * (reduce ? 1 : 0.075);
      if (Math.abs(next - smooth.current) > 0.00002) {
        smooth.current = next;
        setP(next);
      }
      raf = requestAnimationFrame(loop);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Scene 1: the landing photo slowly pushes in, then dissolves into the 3D gallery
  const hero = webgl ? 1 - seg(p, 0.05, 0.1) : 1 - seg(p, 0.6, 0.66);
  const heroScale = 1 + seg(p, 0, 0.1) * 0.08;
  const hint = 1 - seg(p, 0, 0.025);

  // Scene 4 → 5: soft beige fade from the gallery to the isolated carpet
  const veil = seg(p, 0.64, 0.7) * (1 - seg(p, 0.7, 0.76));

  // Scene 7: story while the carpet turns
  const storyT = seg(p, 0.76, 0.93);

  // Scene 9: ending
  const ending = seg(p, 0.95, 0.99);

  return (
    <main className="cd-scroll">
      <div className="cd-stage">
        {webgl ? (
          <Canvas
            className="cd-canvas"
            shadows
            flat
            dpr={[1, 1.5]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            camera={{ fov: 58, near: 0.05, far: 100, position: [0, 1.65, 5.4] }}
          >
            <Scene progress={p} />
          </Canvas>
        ) : (
          <div className="cd-fallback">
            <img src="/carpets/featured.jpg" alt="Featured carpet" />
          </div>
        )}

        {/* Scene 1 — the landing view */}
        <div
          className="cd-hero"
          style={{ opacity: hero, visibility: hero <= 0.001 ? "hidden" : "visible" }}
        >
          <div
            className="cd-hero-frame"
            style={{ transform: `translate(-50%, -50%) scale(${heroScale})` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gallery-hero.jpg" alt="The Carpet Diem gallery" className="cd-hero-img" />
            <h1 className="cd-pillar-title">
              CARPET
              <br />
              DIEM
            </h1>
          </div>
          <div className="cd-vignette" />
          <p className="cd-hint" style={{ opacity: hint }}>
            Scroll to enter
          </p>
        </div>

        <div className="cd-veil" style={{ opacity: veil }} />

        {/* Scene 7 — the story, one moment at a time */}
        <div className="cd-story">
          {STORY.map((s, i) => {
            const w = 1 / STORY.length;
            const a = i * w;
            const o = seg(storyT, a, a + 0.05) * (1 - seg(storyT, a + w - 0.05, a + w));
            return (
              <p
                key={s.label}
                className="cd-story-line"
                style={{ opacity: o, transform: `translateY(${(1 - o) * 18}px)` }}
              >
                <span className="cd-story-label">{s.label}</span>
                {s.text}
              </p>
            );
          })}
        </div>

        {/* Scene 9 — minimal ending */}
        <div
          className="cd-ending"
          style={{ opacity: ending, visibility: ending <= 0.001 ? "hidden" : "visible" }}
        >
          <h2>CARPET DIEM</h2>
        </div>
      </div>
    </main>
  );
}
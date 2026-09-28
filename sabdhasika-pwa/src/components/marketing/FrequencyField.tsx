"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The frequency field — the closing CTA's background.
 *
 * ── What it draws, and why that ─────────────────────────────────────
 *
 * A ridgeline of light whose height across the frame follows Zipf's law: the
 * most frequent word in a language is about `k` times as common as the `k`-th,
 * so the profile is `1 / (1 + rank * k)`. That is not a decorative shape chosen
 * because it looks nice — it is the product's whole thesis rendered as light,
 * and it is the same curve the evidence section plots as bars.
 *
 * Over it: fine vertical filaments, one per column, each breathing on its own
 * clock — the individual words standing on the distribution. Behind it: a
 * second, dimmer, slower ridge, which is what stops the whole thing reading as
 * a flat 2D gradient.
 *
 * ── Why a shader rather than an image or a CSS gradient ─────────────
 *
 * The field is smooth on a scale that 8-bit gradients cannot hold: it is almost
 * entirely near-black, which is exactly where banding is most visible. Doing it
 * in a fragment shader means the dither is computed per-pixel rather than baked
 * into a 200 KB PNG, the whole thing is resolution-independent, and it costs no
 * network request on the page whose job is to load fast.
 *
 * ── How it behaves ──────────────────────────────────────────────────
 *
 * It is additive over `--void`, so it *adds* light to the page rather than
 * covering it, and the card's own near-black stays visible through the gaps.
 * Rendering stops when it scrolls out of view or the tab is hidden, and under
 * `prefers-reduced-motion` it draws a single composed frame and never starts a
 * loop. If WebGL2 is unavailable the canvas stays empty and the CSS gradient
 * fallback beneath it takes over — the section is still legible, just flatter.
 */

/* A full-screen triangle. Cheaper than a quad and has no diagonal seam. */
const VERT = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2  iResolution;
uniform float iTime;
uniform vec2  iMouse;
out vec4 fragColor;

const vec3 LIME   = vec3(0.894, 0.949, 0.133);
const vec3 SIGNAL = vec3(0.008, 0.722, 0.800);
const vec3 IRIS   = vec3(0.388, 0.400, 0.945);

/* Sin-free hash (Dave Hoskins). Cross-platform stable, unlike the sin-based
   one, which drifts on some mobile GPUs. */
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 x) {
  vec2 p = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(p);
  float b = hash12(p + vec2(1.0, 0.0));
  float c = hash12(p + vec2(0.0, 1.0));
  float d = hash12(p + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

/* Four octaves, not six. This runs twice per pixel, and the whole field is
   low-frequency by design — the extra octaves would cost fill rate and be
   invisible under the mist. */
float fbm(vec2 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    f += a * vnoise(p);
    p = ROT * p * 2.03;
    a *= 0.5;
  }
  return f;
}

/* The ridge height at a given x, in the same units as uv.y.
   "steep" is the Zipf exponent: at 7.0 the tenth-ranked column is roughly a
   seventh the height of the first. */
float ridgeAt(float x, float t, float amp, float steep) {
  float rank = clamp(x * 0.5 + 0.5, 0.0, 1.0);
  float zipf = 1.0 / (1.0 + rank * steep);
  float drift = fbm(vec2(x * 2.6 + t * 0.35, t * 0.22));
  return -1.0 + zipf * amp + (drift - 0.5) * 0.10;
}

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - iResolution) / iResolution.y;
  float t = iTime * 0.1;

  /* Pointer parallax, deliberately tiny: this sits behind a headline. */
  uv += (iMouse - 0.5) * 0.045;

  vec3 col = vec3(0.0);

  /* ── the far ridge: haze only, no line, so it reads as depth ── */
  float farRidge = ridgeAt(uv.x + 0.12, t * 0.6, 0.95, 9.0);
  float dFar = uv.y - farRidge;
  col += mix(SIGNAL, IRIS, 0.35) * exp(-max(dFar, 0.0) * 3.4) * 0.055;

  /* ── the near ridge ── */
  float nearRidge = ridgeAt(uv.x, t, 1.15, 7.0);
  float d = uv.y - nearRidge;

  /* Mist rising off it: lime at the base, cooling to signal as it climbs. */
  float mist = exp(-max(d, 0.0) * 2.8);
  col += mix(SIGNAL, LIME, exp(-max(d, 0.0) * 7.0)) * mist * 0.16;

  /* The ridgeline itself. */
  col += LIME * exp(-abs(d) * 62.0) * 0.42;

  /* ── filaments: the words standing on the distribution ──
     132 columns across the frame, each a hairline with its own brightness
     and its own breathing rate, weighted by the same Zipf envelope so the
     tall end of the ridge is also the busiest. */
  const float COLS = 132.0;
  float gx = (uv.x * 0.5 + 0.5) * COLS;
  float fid = floor(gx);
  float ffrac = fract(gx);
  float fseed = hash12(vec2(fid, 3.0));
  float lineMask = 1.0 - smoothstep(0.02, 0.20 + 0.06 * fseed, abs(ffrac - 0.5));
  float rise = exp(-max(d, 0.0) * 13.0);
  float flick = 0.45 + 0.55 * vnoise(vec2(fid * 0.85, iTime * 0.30));
  float rank = clamp(uv.x * 0.5 + 0.5, 0.0, 1.0);
  col += LIME * lineMask * rise * flick * (1.0 / (1.0 + rank * 5.0)) * 0.22;

  /* A faint lift under the ridge, so it rests on something. */
  col += LIME * exp(-max(-d, 0.0) * 5.0) * 0.045;

  /* ── composition ──
     The headline sits in the upper half, so the field is faded out there.
     "1.0 - smoothstep(lo, hi, y)" rather than "smoothstep(hi, lo, y)": GLSL
     leaves the result undefined when edge0 >= edge1. */
  col *= 1.0 - smoothstep(-0.15, 1.15, uv.y);

  float vig = 1.0 - 0.55 * pow(length(uv * vec2(0.55, 0.85)), 2.2);
  col *= clamp(vig, 0.0, 1.0);

  /* Dither. This field is almost entirely dark, which is precisely where an
     8-bit framebuffer bands; a sub-LSB hash breaks the contours up. */
  col += (hash12(gl_FragCoord.xy + fract(iTime)) - 0.5) / 255.0;

  /* Additive over the card, so the near-black shows through the gaps. */
  float alpha = clamp(max(max(col.r, col.g), col.b) * 1.5, 0.0, 1.0);
  fragColor = vec4(col, alpha);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // Surfaced rather than swallowed: a silent failure here means a blank
    // section, which is very hard to diagnose from a screenshot.
    console.error("frequency-field shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function FrequencyField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });

    if (!gl) {
      setUnavailable(true);
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      setUnavailable(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setUnavailable(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("frequency-field link:", gl.getProgramInfoLog(program));
      setUnavailable(true);
      return;
    }
    gl.useProgram(program);

    /* One triangle covering the clip space. */
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    /* Additive: the field adds light to the card rather than painting over it. */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const uRes = gl.getUniformLocation(program, "iResolution");
    const uTime = gl.getUniformLocation(program, "iTime");
    const uMouse = gl.getUniformLocation(program, "iMouse");

    /* Cap the device pixel ratio. At 3x on a phone this field would render
       nine times the pixels for detail that is entirely sub-pixel anyway. */
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let target = 0.5;
    let current = 0.5;
    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      target = (event.clientX - rect.left) / rect.width;
    };

    let frame = 0;
    let running = false;
    const start = performance.now();

    const draw = (now: number) => {
      /* Ease the pointer so the parallax never snaps. */
      current += (target - current) * 0.04;

      const elapsed = reduceMotion ? 11 : (now - start) / 1000;
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, current, 0.5);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    const play = () => {
      if (running) return;
      resize();
      if (reduceMotion) {
        // One composed frame, then never again.
        draw(start + 11000);
        return;
      }
      running = true;
      frame = requestAnimationFrame(loop);
    };

    const pause = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    /* Render only while the section is on screen and the tab is visible.
       A background shader that runs while scrolled past is a battery drain
       with nothing to show for it. */
    const visible = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !document.hidden) play();
        else pause();
      },
      { threshold: 0.01 },
    );
    visible.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) pause();
      else play();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);
    if (!reduceMotion) window.addEventListener("pointermove", onPointer, { passive: true });

    resize();

    return () => {
      pause();
      visible.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div className={className} aria-hidden="true">
      {/* Only rendered when WebGL2 is missing, so the section still reads as
          a lit surface rather than an empty box. */}
      {unavailable && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 22% 118%, rgba(228,242,34,0.20), rgba(2,184,204,0.10) 38%, transparent 68%)",
          }}
        />
      )}
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}

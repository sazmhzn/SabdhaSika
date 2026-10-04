"use client";

import { AlertTriangle, Camera, Hand, Loader2 } from "lucide-react";
import type { RefObject } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import type { SignStatus } from "@/lib/sign/useSignRecognizer";

interface SignCameraProps {
  status: SignStatus;
  error: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hasHand?: boolean;
  onStart: () => void;
  onRetry: () => void;
  /** Rendered over the live feed — the recognised letter, for instance. */
  overlay?: React.ReactNode;
  className?: string;
}

/**
 * The camera panel.
 *
 * The video element is mounted in every state, even before the camera is on,
 * because `start()` needs somewhere to attach the stream — a start button that
 * unmounts its own target is a button that cannot work. The states are layered
 * over it rather than swapped for it.
 *
 * The feed is mirrored (`scaleX(-1)`) so it behaves like a mirror, which is
 * what anyone expects when they raise a hand to a camera. The landmark overlay
 * mirrors with it (see the hook), so the skeleton stays on the hand.
 */
export function SignCamera({
  status,
  error,
  videoRef,
  canvasRef,
  hasHand,
  onStart,
  onRetry,
  overlay,
  className,
}: SignCameraProps) {
  const live = status === "running";

  return (
    <div
      className={cn(
        "surface-card grain relative isolate aspect-[4/3] w-full overflow-hidden",
        className,
      )}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="size-full object-cover [transform:scaleX(-1)]"
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />

      {live && (
        <>
          {overlay}
          {hasHand === false && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-[12.5px] font-medium text-white backdrop-blur">
                <Hand className="size-4" strokeWidth={2.2} />
                Show your hand to the camera
              </span>
            </div>
          )}
        </>
      )}

      {!live && (
        <div className="absolute inset-0 grid place-items-center bg-paper/90 p-6 text-center backdrop-blur-sm">
          {status === "idle" && (
            <div className="flex max-w-xs flex-col items-center gap-4">
              <span className="grid size-14 place-items-center rounded-full border border-line bg-surface text-ink-soft">
                <Camera className="size-6" strokeWidth={2} />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-ink">Turn on the camera</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  Your hand is read on this device. Nothing is uploaded.
                </p>
              </div>
              <Button onClick={onStart} size="lg">
                Start camera
              </Button>
            </div>
          )}

          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 text-muted">
              <Loader2 className="size-6 animate-spin" strokeWidth={2} />
              <p className="text-[13px] font-medium">Starting the camera…</p>
            </div>
          )}

          {(status === "denied" || status === "unsupported" || status === "error") && (
            <div className="flex max-w-xs flex-col items-center gap-4">
              <span className="grid size-14 place-items-center rounded-full border border-line bg-surface text-bad">
                <AlertTriangle className="size-6" strokeWidth={2} />
              </span>
              <p className="text-[13px] leading-relaxed text-ink-soft">
                {error ?? "Something went wrong with the camera."}
              </p>
              {status !== "unsupported" && (
                <Button onClick={onRetry} variant="secondary">
                  Try again
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';

export type GameFrameAttempt = Readonly<{
  identity: string;
  attempt: number;
}>;

const INITIAL_RETRY_DELAY_MILLISECONDS = 1_000;
const MAXIMUM_RETRY_EXPONENT = 2;

export function gameFrameRetryDelay(attempt: number): number {
  const exponent = Math.max(0, Math.min(MAXIMUM_RETRY_EXPONENT, Math.trunc(attempt)));
  return INITIAL_RETRY_DELAY_MILLISECONDS * (2 ** exponent);
}

export function advanceGameFrameAttempt(
  current: GameFrameAttempt,
  identity: string,
): GameFrameAttempt {
  if (current.identity !== identity) return Object.freeze({ identity, attempt: 0 });
  return Object.freeze({
    identity,
    attempt: Math.min(Number.MAX_SAFE_INTEGER, current.attempt + 1),
  });
}

type LiveGameFrameProps = Readonly<{
  developmentSessionId: string;
  gameUrl: string;
  runtimeConnected: boolean;
}>;

export function LiveGameFrame({
  developmentSessionId,
  gameUrl,
  runtimeConnected,
}: LiveGameFrameProps) {
  const identity = `${developmentSessionId}:${gameUrl}`;
  const [frame, setFrame] = useState<GameFrameAttempt>(() => ({ identity, attempt: 0 }));

  useEffect(() => {
    setFrame((current) => (
      current.identity === identity ? current : { identity, attempt: 0 }
    ));
  }, [identity]);

  useEffect(() => {
    if (runtimeConnected || frame.identity !== identity) return undefined;
    const timeout = globalThis.setTimeout(() => {
      setFrame((current) => advanceGameFrameAttempt(current, identity));
    }, gameFrameRetryDelay(frame.attempt));
    return () => globalThis.clearTimeout(timeout);
  }, [frame, identity, runtimeConnected]);

  const attempt = frame.identity === identity ? frame.attempt : 0;
  return (
    <iframe
      allow="autoplay; fullscreen; gamepad; webgpu"
      allowFullScreen
      key={`${identity}:${attempt}`}
      referrerPolicy="no-referrer"
      sandbox="allow-same-origin allow-scripts allow-pointer-lock"
      src={gameUrl}
      title="Live Antiky game"
    />
  );
}

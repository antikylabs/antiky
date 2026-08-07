type LiveGameFrameProps = Readonly<{
  developmentSessionId: string;
  gameUrl: string;
}>;

export function LiveGameFrame({
  developmentSessionId,
  gameUrl,
}: LiveGameFrameProps) {
  return (
    <iframe
      allow="autoplay; fullscreen; gamepad; webgpu"
      allowFullScreen
      data-development-session={developmentSessionId}
      referrerPolicy="no-referrer"
      sandbox="allow-same-origin allow-scripts allow-pointer-lock"
      src={gameUrl}
      title="Live Antiky game"
    />
  );
}

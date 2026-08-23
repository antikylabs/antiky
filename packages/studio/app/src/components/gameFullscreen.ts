export type FullscreenPlatform = 'browser' | 'native';

type BrowserFullscreenTarget = Readonly<{
  requestFullscreen?(): Promise<void>;
}>;

type BrowserFullscreenDocument = Readonly<{
  exitFullscreen?(): Promise<void>;
}>;

type NativeFullscreenWindow = Readonly<{
  setFullscreen(enabled: boolean): Promise<void>;
}>;

export async function changeGameFullscreen({
  browserDocument,
  browserTarget,
  enabled,
  nativeWindow,
  platform,
}: Readonly<{
  browserDocument: BrowserFullscreenDocument;
  browserTarget: BrowserFullscreenTarget;
  enabled: boolean;
  nativeWindow?: NativeFullscreenWindow;
  platform: FullscreenPlatform;
}>): Promise<boolean> {
  if (platform === 'native') {
    if (!nativeWindow) return false;
    await nativeWindow.setFullscreen(enabled);
    return true;
  }

  if (enabled) {
    if (!browserTarget.requestFullscreen) return false;
    await browserTarget.requestFullscreen();
    return true;
  }

  if (!browserDocument.exitFullscreen) return false;
  await browserDocument.exitFullscreen();
  return true;
}

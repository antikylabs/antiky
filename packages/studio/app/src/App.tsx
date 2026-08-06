import { StudioShell } from './components/StudioShell.tsx';
import {
  useStudioDevelopment,
  type StudioPlatform,
} from './development/useStudioDevelopment.ts';

type AppProps = Readonly<{
  platform: StudioPlatform;
}>;

export function App({ platform }: AppProps) {
  const view = useStudioDevelopment(platform);
  return <StudioShell actions={view.actions} context={view.context} development={view.development} platform={platform} />;
}

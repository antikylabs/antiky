import Image from 'next/image';
import Link from 'next/link';
import { demoPosterUrl, type DemoMeta } from '@/lib/demos';

type Props = Readonly<{
  demo: DemoMeta;
  priority?: boolean;
}>;

export default function DemoPoster({ demo, priority = false }: Props) {
  return (
    <Link className="demo-poster" href={`/demos/${demo.slug}`} aria-label={`Open ${demo.title}`}>
      <Image
        src={demoPosterUrl(demo.slug)}
        alt={`${demo.title} running as a current Antiky Framework technical study.`}
        width={2560}
        height={1440}
        sizes="(max-width: 760px) 100vw, 56vw"
        priority={priority}
      />
      <span>Current verified capture · Open study</span>
    </Link>
  );
}

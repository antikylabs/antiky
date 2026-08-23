import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import { STUDIO_RELEASES_READY, STUDIO_RELEASES_URL } from '@/lib/site';

type StudioPrimaryActionProps = {
  className: string;
  fallbackHref?: string;
  fallbackLabel?: string;
};

export default function StudioPrimaryAction({
  className,
  fallbackHref = '/studio',
  fallbackLabel = 'Explore Studio',
}: StudioPrimaryActionProps) {
  if (STUDIO_RELEASES_READY) {
    return (
      <a className={className} href={STUDIO_RELEASES_URL} target="_blank" rel="noreferrer">
        Download Studio <ArrowUpRight />
      </a>
    );
  }

  return (
    <Link className={className} href={fallbackHref}>
      {fallbackLabel} <ArrowRight />
    </Link>
  );
}

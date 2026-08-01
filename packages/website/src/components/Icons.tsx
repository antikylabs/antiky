type IconProps = { className?: string };

export function ArrowRight({ className = 'icon' }: IconProps) {
  return <svg className={className} viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M10 5l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ArrowUpRight({ className = 'icon' }: IconProps) {
  return <svg className={className} viewBox="0 0 18 18" aria-hidden="true"><path d="M4 14 14 4M7 4h7v7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ArrowLeft({ className = 'icon' }: IconProps) {
  return <svg className={className} viewBox="0 0 18 18" aria-hidden="true"><path d="M15 9H4M8 5 4 9l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

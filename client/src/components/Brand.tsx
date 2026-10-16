import { Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand${light ? ' brand-light' : ''}`} to="/" aria-label="Retain home">
      <span className="brand-symbol">
        <Sprout size={22} strokeWidth={1.8} />
      </span>
      retain<span className="brand-dot">.</span>
    </Link>
  );
}

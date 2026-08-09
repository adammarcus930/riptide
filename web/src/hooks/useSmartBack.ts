import { useLocation, useNavigate } from 'react-router-dom';

// Back that respects where you actually came from (Today vs. Program detail
// both push into Day detail). Uses real history when it exists; falls back to
// the hierarchical parent when the screen was the entry point (deep link /
// reload — location.key === 'default' marks the first entry in the stack).
export function useSmartBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(fallback, { replace: true });
  };
}

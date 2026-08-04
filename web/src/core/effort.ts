export type Effort = 'minimal' | 'optimal' | 'maximal';

export const ALL_EFFORTS: Effort[] = ['minimal', 'optimal', 'maximal'];

export function allowedDays(e: Effort): number[] {
  switch (e) {
    case 'minimal': return [2, 3, 4, 5, 6, 7];
    case 'optimal': return [4, 5, 6, 7];
    case 'maximal': return [5, 6, 7];
  }
}

export function effortLabel(e: Effort): string {
  return e.charAt(0).toUpperCase() + e.slice(1);
}

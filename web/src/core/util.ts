/** Swift `Int` division truncates toward zero. All operands here are non-negative. */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** Swift `Double.rounded()` rounds half away from zero. */
export function roundHalf(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

/** Swift `Double.rounded(.up)` = ceiling. */
export function ceilDiv(a: number, b: number): number {
  return Math.ceil(a / b);
}

/** Mirrors a Swift `precondition`: fail fast on a broken caller contract. */
export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

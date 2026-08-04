import type { GeneratedProgram } from './programGenerator';

// Human-readable week, used by snapshot tests. Format is byte-identical to the Swift
// ProgramPrinter: note the em-dash "—" in the header and the trailing newline.
export function table(program: GeneratedProgram): string {
  const out: string[] = [];
  program.days.forEach((day, i) => {
    const total = day.lifts.reduce((s, l) => s + l.sets, 0);
    out.push(`Day ${i + 1} — ${day.lifts.length} lifts, ${total} sets`);
    for (const lift of day.lifts) {
      out.push(`  ${lift.exercise.name} [${lift.exercise.primary}] ${lift.sets} x ${lift.exercise.repRange}`);
    }
  });
  return out.join('\n') + '\n';
}

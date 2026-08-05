import {
  generate,
  DISPLAY_ORDER,
  muscleLabel,
  type Effort,
  type MuscleGroup,
  type ExerciseDefinition,
  type GeneratedProgram,
  type GeneratorInput,
} from '../core';
import type { ProgramDoc, PlannedLiftDoc } from './types';

export interface NewProgramInput {
  name: string;
  effort: Effort;
  days: number;
  selections: Map<MuscleGroup, ExerciseDefinition[]>;
}

export function toGeneratorInput(input: NewProgramInput): GeneratorInput {
  return { effort: input.effort, days: input.days, selections: input.selections };
}

// Mirrors the Swift ProgramMaterializer: generator output copied once into an
// editable ProgramDoc. Pure — no Firestore. `isActive: true`; the caller's batch
// write enforces the single-active invariant.
export function materialize(generated: GeneratedProgram, input: NewProgramInput): ProgramDoc {
  const muscles = DISPLAY_ORDER.filter((m) => (input.selections.get(m) ?? []).length > 0);
  const days = generated.days.map((day, i) => ({
    index: i,
    completedInCycle: false,
    lifts: day.lifts.map((lift, j) => ({
      order: j,
      exerciseId: lift.exercise.id,
      exerciseName: lift.exercise.name,
      muscle: lift.exercise.primary,
      repRange: lift.exercise.repRange,
      targetSets: lift.sets,
    })),
  }));
  return {
    name: input.name,
    effort: input.effort,
    muscles,
    isActive: true,
    daysPerWeek: input.days,
    createdAt: Date.now(),
    days,
  };
}

// Computed focus (Swift ProgramDay.focus): each lift muscle once, in lift order.
export function dayFocus(lifts: PlannedLiftDoc[]): string {
  const seen: MuscleGroup[] = [];
  for (const l of [...lifts].sort((a, b) => a.order - b.order)) {
    if (!seen.includes(l.muscle)) seen.push(l.muscle);
  }
  return seen.map(muscleLabel).join(' · ');
}

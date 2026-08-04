import { ALL_MUSCLES, type MuscleGroup } from './muscleGroup';
import rawExercises from './data/exercises.json';

export interface ExerciseDefinition {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondaries: MuscleGroup[];
  repRange: string;
  blurb: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isMuscleGroup(v: unknown): v is MuscleGroup {
  return typeof v === 'string' && (ALL_MUSCLES as readonly string[]).includes(v);
}

function validateExercises(entries: ExerciseDefinition[]): void {
  for (const e of entries) {
    const id = isNonEmptyString(e.id) ? e.id : '<unknown id>';
    if (!isNonEmptyString(e.id)) {
      throw new Error(`Exercise bank entry has invalid or missing 'id': ${JSON.stringify(e)}`);
    }
    if (!isNonEmptyString(e.name)) {
      throw new Error(`Exercise '${id}' has invalid or missing 'name'`);
    }
    if (!isNonEmptyString(e.repRange)) {
      throw new Error(`Exercise '${id}' has invalid or missing 'repRange'`);
    }
    if (!isMuscleGroup(e.primary)) {
      throw new Error(`Exercise '${id}' has invalid 'primary' muscle group: ${JSON.stringify(e.primary)}`);
    }
    if (!Array.isArray(e.secondaries)) {
      throw new Error(`Exercise '${id}' has invalid 'secondaries': expected an array`);
    }
    for (const s of e.secondaries) {
      if (!isMuscleGroup(s)) {
        throw new Error(`Exercise '${id}' has invalid 'secondaries' entry: ${JSON.stringify(s)}`);
      }
    }
  }
}

const ALL = rawExercises as ExerciseDefinition[];
validateExercises(ALL);
Object.freeze(ALL);

export const ExerciseBank = {
  all: ALL as readonly ExerciseDefinition[],
  exercisesFor(muscle: MuscleGroup): ExerciseDefinition[] {
    return ALL.filter((e) => e.primary === muscle);
  },
  find(id: string): ExerciseDefinition | undefined {
    return ALL.find((e) => e.id === id);
  },
};

import type { MuscleGroup } from './muscleGroup';
import rawExercises from './data/exercises.json';

export interface ExerciseDefinition {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondaries: MuscleGroup[];
  repRange: string;
  blurb: string;
}

const ALL = rawExercises as ExerciseDefinition[];

export const ExerciseBank = {
  all: ALL,
  exercisesFor(muscle: MuscleGroup): ExerciseDefinition[] {
    return ALL.filter((e) => e.primary === muscle);
  },
  find(id: string): ExerciseDefinition | undefined {
    return ALL.find((e) => e.id === id);
  },
};

import type { MuscleGroup } from '../core';

export interface Profile {
  restAlertSec: number;
}
export interface PlannedLiftDoc {
  exerciseId: string;
  exerciseName: string;
  muscle: MuscleGroup;
  repRange: string;
  targetSets: number;
  order: number;
}
export interface ProgramDayDoc {
  index: number;
  focus: string;
  completedInCycle: boolean;
  lifts: PlannedLiftDoc[];
}
export interface ProgramDoc {
  name: string;
  isActive: boolean;
  daysPerWeek: number;
  createdAt: number;
  days: ProgramDayDoc[];
}
export interface SessionDoc {
  programId: string;
  programName: string;
  dayIndex: number;
  startedAt: number;
  finishedAt: number | null;
}
export interface LoggedSetDoc {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weight: number;
  reps: number;
  dayIndex: number;
  loggedAt: number;
}

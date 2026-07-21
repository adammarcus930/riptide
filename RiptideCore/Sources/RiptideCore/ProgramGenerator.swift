import Foundation

public struct GeneratorInput: Sendable {
    public let effort: Effort
    public let days: Int
    /// Ordered as the user picked them; every present muscle has ≥1 exercise.
    public let selections: [MuscleGroup: [ExerciseDefinition]]
    public init(effort: Effort, days: Int, selections: [MuscleGroup: [ExerciseDefinition]]) {
        self.effort = effort
        self.days = days
        self.selections = selections
    }
}

public struct GeneratedLift: Equatable, Sendable {
    public let exercise: ExerciseDefinition
    public let sets: Int
}

public struct GeneratedDay: Equatable, Sendable {
    public let lifts: [GeneratedLift]
}

public struct GeneratedProgram: Equatable, Sendable {
    public let days: [GeneratedDay]
}

public enum ProgramGenerator {
    /// Deterministic, total over wizard-valid input (spec §5). Never throws.
    public static func generate(_ input: GeneratorInput) -> GeneratedProgram {
        precondition(input.effort.allowedDays.contains(input.days), "wizard gates day counts")

        let selected = MuscleGroup.processingOrder.filter { !(input.selections[$0] ?? []).isEmpty }
        var dayLifts: [[GeneratedLift]] = Array(repeating: [], count: input.days)
        var dayTotals = [Int](repeating: 0, count: input.days)
        var secondarySets: [MuscleGroup: Int] = [:]

        for (mIndex, muscle) in selected.enumerated() {
            let exercises = input.selections[muscle]!
            let range = VolumeTable.weeklyRange(for: muscle, effort: input.effort)
            var target = Allocation.weeklyTarget(range: range, days: input.days)

            // Spec §5.2: receivers get 0.5 credit per secondary set, floor, never below 0.
            if MuscleGroup.receivers.contains(muscle) {
                let credit = (secondarySets[muscle] ?? 0) / 2
                target = max(0, target - credit)
                if target == 1 { target = 2 } // min-appearance rule
            }
            guard target >= 2 else { continue }

            // Spec §5.6 ladder step 4: clamp to capacity. Capacity always covers
            // range.low for every reachable (muscle, effort, days, exerciseCount)
            // combination under the corrected volume table — see
            // testExhaustiveSweepFindsNoReachableShortfall in RiptideCoreTests.
            let capacity = input.days * exercises.count * 4
            let achieved = min(target, capacity)
            guard achieved >= 2 else { continue }

            let loads = Allocation.dayLoads(total: achieved, days: input.days, maxEntriesPerDay: exercises.count)

            // Spread this muscle's sessions evenly across the week so it isn't
            // trained several days in a row then left out (spec §5.5). Every
            // rotation of the even-spacing pattern is equally "spread", so pick
            // the rotation that best levels the running daily totals — this keeps
            // both goals: each muscle spaced out AND no day overloaded.
            let k = loads.count
            var dayOrder = Allocation.spreadDays(k: k, over: input.days, phase: 0)
                .sorted { dayTotals[$0] < dayTotals[$1] }
            var bestScore = Int.max
            for phase in 0..<input.days {
                let slots = Allocation.spreadDays(k: k, over: input.days, phase: phase)
                    .sorted { dayTotals[$0] < dayTotals[$1] }
                var trial = dayTotals
                for (i, load) in loads.enumerated() { trial[slots[i]] += load }
                let score = trial.reduce(0) { $0 + $1 * $1 }   // lower = more level
                if score < bestScore { bestScore = score; dayOrder = slots }
            }

            var rotation = 0
            for (i, load) in loads.enumerated() {
                let d = dayOrder[i]
                for size in Allocation.entrySizes(sets: load, maxEntries: exercises.count) {
                    let ex = exercises[rotation % exercises.count]
                    rotation += 1
                    dayLifts[d].append(GeneratedLift(exercise: ex, sets: size))
                    dayTotals[d] += size
                    for sec in ex.secondaries { secondarySets[sec, default: 0] += size }
                }
            }
        }

        // Within-day ordering: compounds-first display order (spec §5.7 / design PARTS order).
        let days = dayLifts.map { lifts in
            GeneratedDay(lifts: lifts.sorted { a, b in
                let ia = MuscleGroup.displayOrder.firstIndex(of: a.exercise.primary)!
                let ib = MuscleGroup.displayOrder.firstIndex(of: b.exercise.primary)!
                return ia == ib ? a.exercise.name < b.exercise.name : ia < ib
            })
        }
        return GeneratedProgram(days: days)
    }
}

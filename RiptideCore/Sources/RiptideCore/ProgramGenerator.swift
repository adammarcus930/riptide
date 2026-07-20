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

public struct Shortfall: Equatable, Sendable {
    public let muscle: MuscleGroup
    public let achieved: Int
    public let target: Int
}

public struct GeneratedProgram: Equatable, Sendable {
    public let days: [GeneratedDay]
    public let shortfalls: [Shortfall]
}

public enum ProgramGenerator {
    /// Deterministic, total over wizard-valid input (spec §5). Never throws.
    public static func generate(_ input: GeneratorInput) -> GeneratedProgram {
        precondition(input.effort.allowedDays.contains(input.days), "wizard gates day counts")

        let selected = MuscleGroup.processingOrder.filter { !(input.selections[$0] ?? []).isEmpty }
        var dayLifts: [[GeneratedLift]] = Array(repeating: [], count: input.days)
        var dayTotals = [Int](repeating: 0, count: input.days)
        var secondarySets: [MuscleGroup: Int] = [:]
        var shortfalls: [Shortfall] = []

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

            // Spec §5.6 ladder steps 4–5: clamp to capacity; flag genuine undershoot.
            let capacity = input.days * exercises.count * 4
            let achieved = min(target, capacity)
            if achieved < target && achieved < range.low {
                shortfalls.append(Shortfall(muscle: muscle, achieved: achieved, target: max(range.low, 2)))
            }
            guard achieved >= 2 else { continue }

            let loads = Allocation.dayLoads(total: achieved, days: input.days, maxEntriesPerDay: exercises.count)

            // Stagger (spec §5.5): emptiest days first, rotating tie-break so
            // light muscles don't all pile onto day 1.
            let offset = mIndex % input.days
            let dayOrder = (0..<input.days).sorted { a, b in
                (dayTotals[a], (a + input.days - offset) % input.days)
                    < (dayTotals[b], (b + input.days - offset) % input.days)
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
        return GeneratedProgram(days: days, shortfalls: shortfalls)
    }
}

import XCTest
@testable import RiptideCore

final class ProgramGeneratorTests: XCTestCase {
    /// Full selection: every muscle, first two bank exercises each.
    private func fullInput(effort: Effort, days: Int, perMuscle: Int = 2) -> GeneratorInput {
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        for m in MuscleGroup.allCases {
            sel[m] = Array(ExerciseBank.exercises(for: m).prefix(perMuscle))
        }
        return GeneratorInput(effort: effort, days: days, selections: sel)
    }

    func testDeterminism() {
        let input = fullInput(effort: .optimal, days: 4)
        XCTAssertEqual(ProgramGenerator.generate(input), ProgramGenerator.generate(input))
    }

    func testInvariantsAcrossAllEffortsAndDayCounts() {
        for effort in Effort.allCases {
            for days in effort.allowedDays {
                for perMuscle in 1...3 {
                    let input = fullInput(effort: effort, days: days, perMuscle: perMuscle)
                    let program = ProgramGenerator.generate(input)
                    XCTAssertEqual(program.days.count, days)

                    var weeklySets: [MuscleGroup: Int] = [:]
                    var secondarySets: [MuscleGroup: Int] = [:]
                    for day in program.days {
                        var musclesSeenToday: [MuscleGroup: Set<String>] = [:]
                        for lift in day.lifts {
                            // Entry cap: 2–4 sets, always (spec §5.4).
                            XCTAssertTrue((2...4).contains(lift.sets), "\(effort) \(days)d: \(lift.exercise.id) \(lift.sets) sets")
                            // Same exercise never twice in one day.
                            XCTAssertFalse(musclesSeenToday[lift.exercise.primary, default: []].contains(lift.exercise.id))
                            musclesSeenToday[lift.exercise.primary, default: []].insert(lift.exercise.id)
                            weeklySets[lift.exercise.primary, default: 0] += lift.sets
                            for sec in lift.exercise.secondaries { secondarySets[sec, default: 0] += lift.sets }
                        }
                    }
                    // Volume: direct + credits meet the low end (spec §5.6). Under the corrected
                    // table capacity never falls short of range.low, so there is no shortfall path.
                    for m in MuscleGroup.allCases {
                        let range = VolumeTable.weeklyRange(for: m, effort: effort)
                        guard range.high >= 2 else { continue }
                        let direct = weeklySets[m, default: 0]
                        let credit = secondarySets[m, default: 0] / 2
                        if !(input.selections[m] ?? []).isEmpty {
                            XCTAssertGreaterThanOrEqual(direct + credit, range.low, "\(effort) \(days)d \(perMuscle)ex: \(m)")
                        }
                        XCTAssertLessThanOrEqual(direct, range.high, "\(effort) \(days)d: \(m) over range")
                    }
                    // Day balance: totals stay level (spec §5.5).
                    let totals = program.days.map { $0.lifts.reduce(0) { $0 + $1.sets } }
                    if let hi = totals.max(), let lo = totals.min() {
                        XCTAssertLessThanOrEqual(hi - lo, 8, "\(effort) \(days)d \(perMuscle)ex: uneven days \(totals)")
                    }
                }
            }
        }
    }

    func testRotationCoversChosenExercises() {
        let input = fullInput(effort: .optimal, days: 5, perMuscle: 3)
        let program = ProgramGenerator.generate(input)
        let chestUsed = Set(program.days.flatMap(\.lifts).filter { $0.exercise.primary == .chest }.map(\.exercise.id))
        XCTAssertEqual(chestUsed.count, 3, "all three chest exercises should rotate in")
    }

    func testSecondaryCreditsReduceDirectReceiverWork() {
        // With heavy pressing selected, direct triceps volume must sit below the raw target.
        let input = fullInput(effort: .optimal, days: 4, perMuscle: 2)
        let program = ProgramGenerator.generate(input)
        let directTriceps = program.days.flatMap(\.lifts)
            .filter { $0.exercise.primary == .triceps }.reduce(0) { $0 + $1.sets }
        let rawTarget = Allocation.weeklyTarget(range: VolumeTable.weeklyRange(for: .triceps, effort: .optimal), days: 4)
        XCTAssertLessThan(directTriceps, rawTarget)
    }

    func testNoShortfallWithSingleExerciseUnderCorrectedTable() {
        // Historical note: this exact shape (minimal effort, 2 days, ONE shoulder
        // exercise) used to shortfall under the old combined `shoulders` row
        // (10–18 minimal, a sum of side+rear prescriptions) because capacity
        // 2×1×4=8 < low end 10.
        //
        // After the split, every muscle's minimal-effort low end fits within
        // capacity = minDays(effort) × 1 exercise × 4 sets. sideDelts is the
        // tightest fit in the whole table (its maximal-effort low end, 20, is
        // exactly equal to 5 days × 1 × 4 = 20 — see
        // testCapacityClampsExactlyToLowEndWithoutShortfall below), and
        // testExhaustiveSweepFindsNoReachableShortfall below sweeps every
        // (muscle, effort, days, exercise-count 1–3) combination and confirms
        // zero shortfalls are reachable through the generator with this table.
        // So a single-exercise selection can no longer under-supply any
        // muscle — which is the whole point of the fix: the ranges are now
        // correctly scoped per muscle instead of an inflated sum. This test
        // documents that the old trigger case is now clean.
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        sel[.sideDelts] = [ExerciseBank.find("db-lateral-raise")!]
        let program = ProgramGenerator.generate(GeneratorInput(effort: .minimal, days: 2, selections: sel))
        let sideDeltSets = program.days.flatMap(\.lifts).reduce(0) { $0 + $1.sets }
        let range = VolumeTable.weeklyRange(for: .sideDelts, effort: .minimal)
        XCTAssertGreaterThanOrEqual(sideDeltSets, range.low)
    }

    func testCapacityClampsExactlyToLowEndWithoutShortfall() {
        // sideDelts maximal effort (20–26) at 5 days (the minimum days maximal
        // allows) with ONE exercise is the single tightest cell in the whole
        // corrected table: capacity = 5 × 1 × 4 = 20, exactly equal to the low
        // end. The ideal weekly target (nearest-to-midpoint multiple of 5 in
        // [20, 26]) is 25, so capacity clamps achieved sets down to 20 — but
        // since 20 meets (not undershoots) the low end, this is a clean clamp,
        // not an undersupply (spec §5.6: capacity clamp only ever lands at or
        // above range.low under the corrected table). This exercises the
        // clamp path that the (now-deleted) shortfall mechanism used to guard.
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        sel[.sideDelts] = [ExerciseBank.find("db-lateral-raise")!]
        let program = ProgramGenerator.generate(GeneratorInput(effort: .maximal, days: 5, selections: sel))
        let totalSets = program.days.flatMap(\.lifts).reduce(0) { $0 + $1.sets }
        XCTAssertEqual(totalSets, 20)
        let range = VolumeTable.weeklyRange(for: .sideDelts, effort: .maximal)
        XCTAssertEqual(totalSets, range.low)
        let idealTarget = Allocation.weeklyTarget(range: range, days: 5)
        XCTAssertGreaterThan(idealTarget, totalSets, "ideal target (25) exceeds what one exercise can supply, proving capacity genuinely clamped")
    }

    /// Real replacement for the "exhaustive sweep" that used to be run ad hoc from a
    /// throwaway executable (since deleted) and cited only in a comment above. Sweeps every
    /// (muscle, effort, days, exercise-count 1–3) cell reachable through the wizard with a
    /// single-muscle selection and asserts none of them shortfall.
    ///
    /// The safety margin here is NOT comfortable everywhere: sideDelts/maximal/5-days/
    /// 1-exercise sits at capacity == range.low exactly (5 × 1 × 4 = 20 == 20, see
    /// testCapacityClampsExactlyToLowEndWithoutShortfall), a zero-margin boundary. This test
    /// is what would catch a future VolumeTable edit that pushes any cell's low end even one
    /// set past its capacity and reintroduces a reachable shortfall.
    func testExhaustiveSweepFindsNoReachableShortfall() {
        for muscle in MuscleGroup.allCases {
            let available = ExerciseBank.exercises(for: muscle)
            guard !available.isEmpty else { continue }
            for effort in Effort.allCases {
                let range = VolumeTable.weeklyRange(for: muscle, effort: effort)
                guard range.high >= 2 else { continue }
                for days in effort.allowedDays {
                    for exerciseCount in 1...3 {
                        // The invariant that makes the (now-deleted) shortfall path
                        // unreachable: capacity (days * exerciseCount entries * 4 sets/entry)
                        // must cover the range's low end, so `achieved = min(target, capacity)`
                        // in ProgramGenerator.generate never falls below range.low. Recomputed
                        // directly from the table here — not a restatement of generator
                        // behavior — so a future VolumeTable edit that pushes any cell's low
                        // end past its capacity fails this line first.
                        let capacity = days * exerciseCount * 4
                        XCTAssertGreaterThanOrEqual(capacity, range.low,
                            "\(muscle) \(effort) \(days)d \(exerciseCount)ex: capacity \(capacity) below low end \(range.low)")

                        // And confirm the generator actually delivers on that invariant in
                        // practice (rotation/day-splitting doesn't leak sets below the floor).
                        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
                        sel[muscle] = Array(available.prefix(exerciseCount))
                        let program = ProgramGenerator.generate(GeneratorInput(effort: effort, days: days, selections: sel))
                        let totalSets = program.days.flatMap(\.lifts).reduce(0) { $0 + $1.sets }
                        XCTAssertGreaterThanOrEqual(totalSets, range.low,
                            "\(muscle) \(effort) \(days)d \(exerciseCount)ex: generated \(totalSets) below low end \(range.low)")
                    }
                }
            }
        }
    }

    func testUnselectedMusclesAreAbsent() {
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        sel[.chest] = Array(ExerciseBank.exercises(for: .chest).prefix(2))
        let program = ProgramGenerator.generate(GeneratorInput(effort: .optimal, days: 4, selections: sel))
        XCTAssertTrue(program.days.flatMap(\.lifts).allSatisfy { $0.exercise.primary == .chest })
    }
}

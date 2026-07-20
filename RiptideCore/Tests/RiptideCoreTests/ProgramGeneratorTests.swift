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
                    // Volume: direct + credits within/above low end, or shortfall recorded (spec §5.6).
                    let flagged = Set(program.shortfalls.map(\.muscle))
                    for m in MuscleGroup.allCases {
                        let range = VolumeTable.weeklyRange(for: m, effort: effort)
                        guard range.high >= 2 else { continue }
                        let direct = weeklySets[m, default: 0]
                        let credit = secondarySets[m, default: 0] / 2
                        if !flagged.contains(m) {
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

    func testShortfallSurfacedWhenCapacityTooSmall() {
        // Minimal effort, 2 days, ONE shoulder exercise: capacity 2×1×4=8 < low end 10.
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        sel[.shoulders] = [ExerciseBank.find("db-lateral-raise")!]
        let program = ProgramGenerator.generate(GeneratorInput(effort: .minimal, days: 2, selections: sel))
        XCTAssertEqual(program.shortfalls.count, 1)
        XCTAssertEqual(program.shortfalls[0].muscle, .shoulders)
        XCTAssertEqual(program.shortfalls[0].achieved, 8)
        XCTAssertEqual(program.shortfalls[0].target, 10)
    }

    func testUnselectedMusclesAreAbsent() {
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        sel[.chest] = Array(ExerciseBank.exercises(for: .chest).prefix(2))
        let program = ProgramGenerator.generate(GeneratorInput(effort: .optimal, days: 4, selections: sel))
        XCTAssertTrue(program.days.flatMap(\.lifts).allSatisfy { $0.exercise.primary == .chest })
    }
}

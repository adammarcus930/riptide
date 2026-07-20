import XCTest
@testable import RiptideCore

final class ExerciseBankTests: XCTestCase {
    func testBankLoadsAndIsWellFormed() {
        let all = ExerciseBank.all
        XCTAssertGreaterThanOrEqual(all.count, 40)
        XCTAssertEqual(Set(all.map(\.id)).count, all.count, "ids must be unique")
        for ex in all {
            XCTAssertFalse(ex.secondaries.contains(ex.primary), "\(ex.id): primary repeated in secondaries")
            XCTAssertFalse(ex.name.isEmpty)
            XCTAssertFalse(ex.repRange.isEmpty)
        }
    }

    func testEveryMuscleHasAtLeastTwoExercises() {
        for m in MuscleGroup.allCases {
            XCTAssertGreaterThanOrEqual(ExerciseBank.exercises(for: m).count, 2, "\(m)")
        }
    }

    func testSecondariesFollowObviousOnlyRule() {
        // Spot checks straight from the spec (§6).
        XCTAssertEqual(ExerciseBank.find("bench-press")?.secondaries, [.triceps])
        XCTAssertEqual(ExerciseBank.find("pull-up")?.secondaries, [.biceps])
        XCTAssertEqual(ExerciseBank.find("overhead-press")?.secondaries, [.triceps])
        XCTAssertEqual(ExerciseBank.find("back-squat")?.secondaries, [])   // no technicality credits
        XCTAssertEqual(ExerciseBank.find("romanian-deadlift")?.secondaries, [])
    }
}

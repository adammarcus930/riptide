import XCTest
import RiptideCore
@testable import Riptide

final class SmokeTests: XCTestCase {
    func testCoreIsLinked() {
        XCTAssertEqual(MuscleGroup.allCases.count, 11)
        XCTAssertGreaterThanOrEqual(ExerciseBank.all.count, 40)
    }
}

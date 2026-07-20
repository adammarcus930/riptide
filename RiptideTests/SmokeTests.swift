import XCTest
import RiptideCore
@testable import Riptide

final class SmokeTests: XCTestCase {
    func testCoreIsLinked() {
        XCTAssertEqual(MuscleGroup.allCases.count, 13)
        XCTAssertGreaterThanOrEqual(ExerciseBank.all.count, 40)
    }
}

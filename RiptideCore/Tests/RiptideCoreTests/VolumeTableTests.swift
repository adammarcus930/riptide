import XCTest
@testable import RiptideCore

final class VolumeTableTests: XCTestCase {
    func testAllowedDaysPerEffort() {
        XCTAssertEqual(Effort.minimal.allowedDays, 2...7)
        XCTAssertEqual(Effort.optimal.allowedDays, 4...7)
        XCTAssertEqual(Effort.maximal.allowedDays, 5...7)
    }

    func testSpotCheckRanges() {
        XCTAssertEqual(VolumeTable.weeklyRange(for: .chest, effort: .optimal), SetRange(10, 14))
        XCTAssertEqual(VolumeTable.weeklyRange(for: .shoulders, effort: .minimal), SetRange(10, 18))
        XCTAssertEqual(VolumeTable.weeklyRange(for: .shoulders, effort: .maximal), SetRange(38, 50))
        XCTAssertEqual(VolumeTable.weeklyRange(for: .forearms, effort: .minimal), SetRange(0, 3))
        XCTAssertEqual(VolumeTable.weeklyRange(for: .hamstrings, effort: .optimal), SetRange(8, 12))
    }

    func testEveryMuscleHasARangeForEveryEffort() {
        for m in MuscleGroup.allCases {
            for e in Effort.allCases {
                let r = VolumeTable.weeklyRange(for: m, effort: e)
                XCTAssertLessThanOrEqual(r.low, r.high, "\(m) \(e)")
            }
        }
    }

    func testOrderings() {
        XCTAssertEqual(MuscleGroup.givers + MuscleGroup.receivers, MuscleGroup.processingOrder)
        XCTAssertEqual(Set(MuscleGroup.displayOrder), Set(MuscleGroup.allCases))
        XCTAssertEqual(MuscleGroup.displayOrder.count, 11)
    }
}

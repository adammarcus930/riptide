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
        XCTAssertEqual(VolumeTable.weeklyRange(for: .frontDelts, effort: .minimal), SetRange(0, 4))
        XCTAssertEqual(VolumeTable.weeklyRange(for: .frontDelts, effort: .maximal), SetRange(10, 12))
        XCTAssertEqual(VolumeTable.weeklyRange(for: .sideDelts, effort: .minimal), SetRange(6, 10))
        XCTAssertEqual(VolumeTable.weeklyRange(for: .sideDelts, effort: .maximal), SetRange(20, 26))
        XCTAssertEqual(VolumeTable.weeklyRange(for: .rearDelts, effort: .minimal), SetRange(4, 8))
        XCTAssertEqual(VolumeTable.weeklyRange(for: .rearDelts, effort: .maximal), SetRange(18, 24))
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
        XCTAssertEqual(MuscleGroup.displayOrder.count, 13)
    }
}

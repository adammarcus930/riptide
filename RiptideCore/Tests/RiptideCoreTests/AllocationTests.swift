import XCTest
@testable import RiptideCore

final class AllocationTests: XCTestCase {
    // Spec §5.1: midpoint nudged within range toward clean division.
    func testWeeklyTargetPrefersDivisibleNearMidpoint() {
        XCTAssertEqual(Allocation.weeklyTarget(range: SetRange(10, 14), days: 4), 12) // mid divides
        XCTAssertEqual(Allocation.weeklyTarget(range: SetRange(10, 14), days: 5), 10) // nearest divisible
        XCTAssertEqual(Allocation.weeklyTarget(range: SetRange(8, 12), days: 7), 10)  // none divisible → mid
        XCTAssertEqual(Allocation.weeklyTarget(range: SetRange(0, 3), days: 7), 2)    // never below 2
        XCTAssertEqual(Allocation.weeklyTarget(range: SetRange(0, 1), days: 4), 0)    // range too small to program
    }

    // Spec §5 ladder: prefer 3s → split → 4s; entries always 2–4 sets.
    func testEntrySizes() {
        XCTAssertEqual(Allocation.entrySizes(sets: 2, maxEntries: 1), [2])
        XCTAssertEqual(Allocation.entrySizes(sets: 3, maxEntries: 1), [3])
        XCTAssertEqual(Allocation.entrySizes(sets: 4, maxEntries: 2), [2, 2]) // split before 4s
        XCTAssertEqual(Allocation.entrySizes(sets: 4, maxEntries: 1), [4])   // 4 only when forced
        XCTAssertEqual(Allocation.entrySizes(sets: 5, maxEntries: 2), [3, 2])
        XCTAssertEqual(Allocation.entrySizes(sets: 6, maxEntries: 2), [3, 3])
        XCTAssertEqual(Allocation.entrySizes(sets: 7, maxEntries: 3), [3, 2, 2])
        XCTAssertEqual(Allocation.entrySizes(sets: 8, maxEntries: 2), [4, 4])
        for sets in 2...16 {
            let maxE = Int((Double(sets) / 4.0).rounded(.up))
            for m in maxE...5 {
                let sizes = Allocation.entrySizes(sets: sets, maxEntries: m)
                XCTAssertEqual(sizes.reduce(0, +), sets)
                XCTAssertTrue(sizes.allSatisfy { (2...4).contains($0) }, "sets \(sets) maxE \(m): \(sizes)")
                XCTAssertLessThanOrEqual(sizes.count, m)
            }
        }
    }

    // Spec §5.3/5.5: even split; low volume appears on fewer days, ≥2 sets each.
    func testDayLoads() {
        XCTAssertEqual(Allocation.dayLoads(total: 12, days: 4, maxEntriesPerDay: 2), [3, 3, 3, 3])
        XCTAssertEqual(Allocation.dayLoads(total: 14, days: 4, maxEntriesPerDay: 1), [4, 4, 3, 3])
        XCTAssertEqual(Allocation.dayLoads(total: 6, days: 6, maxEntriesPerDay: 2), [2, 2, 2])   // stagger
        XCTAssertEqual(Allocation.dayLoads(total: 28, days: 5, maxEntriesPerDay: 2), [6, 6, 6, 5, 5])
        XCTAssertEqual(Allocation.dayLoads(total: 2, days: 7, maxEntriesPerDay: 3), [2])
        XCTAssertEqual(Allocation.dayLoads(total: 0, days: 4, maxEntriesPerDay: 2), [])
    }
}

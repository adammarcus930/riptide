import XCTest
@testable import RiptideCore

final class AllocationTests: XCTestCase {
    // Spec §5.1: target is the range midpoint, floored at 2, independent of days.
    func testWeeklyTargetIsMidpoint() {
        XCTAssertEqual(Allocation.weeklyTarget(range: SetRange(10, 14)), 12) // (10+14)/2
        XCTAssertEqual(Allocation.weeklyTarget(range: SetRange(12, 18)), 15) // (12+18)/2
        XCTAssertEqual(Allocation.weeklyTarget(range: SetRange(8, 12)), 10)
        XCTAssertEqual(Allocation.weeklyTarget(range: SetRange(0, 3)), 2)    // mid 1 → floored to 2
        XCTAssertEqual(Allocation.weeklyTarget(range: SetRange(0, 1)), 0)    // range too small to program
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

    // Spec §5.5: concentrate at ~3 sets/appearance so a muscle lands on fewer
    // days (minimizing lifts/day), while respecting the per-day capacity cap.
    func testDayLoads() {
        XCTAssertEqual(Allocation.dayLoads(total: 12, days: 4, maxEntriesPerDay: 2), [3, 3, 3, 3])
        XCTAssertEqual(Allocation.dayLoads(total: 14, days: 4, maxEntriesPerDay: 1), [4, 4, 3, 3]) // capped at 4 days
        XCTAssertEqual(Allocation.dayLoads(total: 28, days: 5, maxEntriesPerDay: 2), [6, 6, 6, 5, 5]) // capped at 5 days
        XCTAssertEqual(Allocation.dayLoads(total: 2, days: 7, maxEntriesPerDay: 3), [2])
        XCTAssertEqual(Allocation.dayLoads(total: 0, days: 4, maxEntriesPerDay: 2), [])
    }

    // Spec §5.5: a muscle's appearances spread across the week, not a contiguous block.
    func testSpreadDaysIsEvenNotContiguous() {
        XCTAssertEqual(Allocation.spreadDays(k: 4, over: 6, phase: 0).sorted(), [0, 2, 3, 5])
        XCTAssertEqual(Allocation.spreadDays(k: 4, over: 7, phase: 0).sorted(), [0, 2, 4, 6])
        XCTAssertEqual(Allocation.spreadDays(k: 2, over: 6, phase: 0).sorted(), [1, 4])
        XCTAssertEqual(Allocation.spreadDays(k: 6, over: 6, phase: 3), [0, 1, 2, 3, 4, 5]) // k>=days → all
        // Distinct, in range, and evenly spaced around the (cyclic) week: gaps
        // between consecutive training days differ by at most 1.
        for days in 2...7 {
            for k in 1..<days {
                for phase in 0..<days {
                    let s = Allocation.spreadDays(k: k, over: days, phase: phase)
                    XCTAssertEqual(Set(s).count, k, "k=\(k) days=\(days) phase=\(phase): \(s)")
                    XCTAssertTrue(s.allSatisfy { (0..<days).contains($0) })
                    if k >= 2 {
                        let sorted = s.sorted()
                        var gaps = zip(sorted, sorted.dropFirst()).map { $1 - $0 }
                        gaps.append(sorted.first! + days - sorted.last!) // wrap-around gap
                        XCTAssertLessThanOrEqual(gaps.max()! - gaps.min()!, 1,
                            "k=\(k) days=\(days) phase=\(phase) uneven: \(s) gaps \(gaps)")
                    }
                }
            }
        }
    }

    // Concentration: with plenty of days available, a muscle lands on ~total/3
    // days at 3 sets each rather than being spread thin at 2 sets everywhere.
    func testDayLoadsConcentratesRatherThanSpreading() {
        XCTAssertEqual(Allocation.dayLoads(total: 12, days: 6, maxEntriesPerDay: 2), [3, 3, 3, 3]) // 4 days, not 6×2
        XCTAssertEqual(Allocation.dayLoads(total: 6, days: 6, maxEntriesPerDay: 2), [3, 3])        // 2 days, not 3×2
        XCTAssertEqual(Allocation.dayLoads(total: 9, days: 7, maxEntriesPerDay: 2), [3, 3, 3])
        // Every appearance stays within 2–4 after entry-splitting bounds still hold.
        for total in 2...24 {
            let loads = Allocation.dayLoads(total: total, days: 7, maxEntriesPerDay: 3)
            XCTAssertEqual(loads.reduce(0, +), total, "total \(total)")
            XCTAssertTrue(loads.allSatisfy { $0 >= 2 }, "total \(total): \(loads)")
        }
    }
}

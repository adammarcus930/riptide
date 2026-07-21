import Foundation

enum Allocation {
    /// Spec §5.1: midpoint of the effort range, nudged within the range to the
    /// value nearest the midpoint that divides evenly across `days` (ties → higher).
    /// Returns 0 when the range can't support the 2-set minimum.
    static func weeklyTarget(range: SetRange, days: Int) -> Int {
        guard range.high >= 2 else { return 0 }
        let mid = (range.low + range.high) / 2
        let low = max(range.low, 2)
        let divisibles = (low...range.high).filter { $0 % days == 0 }
        if let best = divisibles.min(by: { (abs($0 - mid), -$0) < (abs($1 - mid), -$1) }) {
            return best
        }
        return max(mid, 2)
    }

    /// Split one day's sets for one muscle into lift entries of 2–4 sets.
    /// Ladder order (spec §5.6): prefer 3s, then split across more exercises,
    /// then 4-set entries. `maxEntries` = distinct exercises chosen for the muscle.
    static func entrySizes(sets: Int, maxEntries: Int) -> [Int] {
        precondition(sets >= 2 && sets <= maxEntries * 4, "caller must clamp to capacity")
        var count = Int((Double(sets) / 3.0).rounded(.up))
        if count > maxEntries { count = Int((Double(sets) / 4.0).rounded(.up)) }
        let base = sets / count
        let rem = sets % count
        return (0..<count).map { $0 < rem ? base + 1 : base }
    }

    /// How many days a muscle appears on and how many sets each such day carries.
    /// Concentrates volume at ~3 sets per appearance so a muscle lands on fewer
    /// days rather than being spread thin at 2 sets across every day — this
    /// minimizes lifts per day (spec §5.5). Every appearance is ≥ 2 sets, and
    /// `k` is raised if needed so no day exceeds the per-day capacity cap.
    /// Returns loads largest-first; caller assigns them to the emptiest days.
    static func dayLoads(total: Int, days: Int, maxEntriesPerDay: Int) -> [Int] {
        guard total >= 2 else { return [] }
        let dailyCap = maxEntriesPerDay * 4
        var k = max(1, Int((Double(total) / 3.0).rounded()))            // ~3 sets/appearance
        k = min(k, days)                                                // can't exceed available days
        k = max(k, Int((Double(total) / Double(dailyCap)).rounded(.up))) // but respect per-day cap
        precondition(k <= days, "caller must clamp total to days * dailyCap")
        let base = total / k
        let rem = total % k
        return (0..<k).map { $0 < rem ? base + 1 : base }
    }
}

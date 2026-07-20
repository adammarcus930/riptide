public enum ProgramPrinter {
    /// Human-readable week, used by snapshot tests and future debug screens.
    public static func table(_ program: GeneratedProgram) -> String {
        var out: [String] = []
        for (i, day) in program.days.enumerated() {
            let total = day.lifts.reduce(0) { $0 + $1.sets }
            out.append("Day \(i + 1) — \(day.lifts.count) lifts, \(total) sets")
            for lift in day.lifts {
                out.append("  \(lift.exercise.name) [\(lift.exercise.primary.rawValue)] \(lift.sets) x \(lift.exercise.repRange)")
            }
        }
        for s in program.shortfalls {
            out.append("SHORTFALL \(s.muscle.rawValue): \(s.achieved) of \(s.target) target sets")
        }
        return out.joined(separator: "\n") + "\n"
    }
}

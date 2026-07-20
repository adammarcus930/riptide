import Foundation
import SwiftData
import RiptideCore

enum ProgramMaterializer {
    /// Spec §4: generator output is copied once into editable rows; user edits
    /// are never overwritten by regeneration.
    @discardableResult
    static func materialize(_ generated: GeneratedProgram, named name: String,
                            input: GeneratorInput, in context: ModelContext) -> Program {
        if let existing = try? context.fetch(FetchDescriptor<Program>()) {
            for p in existing { p.isActive = false }
        }
        let muscles = MuscleGroup.displayOrder.filter { !(input.selections[$0] ?? []).isEmpty }
        let program = Program(name: name, effort: input.effort, daysPerWeek: input.days, muscles: muscles)
        program.isActive = true
        context.insert(program)
        for (i, day) in generated.days.enumerated() {
            let d = ProgramDay(index: i)
            d.program = program
            context.insert(d)
            for (j, lift) in day.lifts.enumerated() {
                let pl = PlannedLift(order: j, exercise: lift.exercise, targetSets: lift.sets)
                pl.day = d
                context.insert(pl)
            }
        }
        try? context.save()
        return program
    }
}

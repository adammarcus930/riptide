import RiptideCore
// Optimal, 6 days, everything EXCEPT abs, hamstrings, forearms
let skip: Set<MuscleGroup> = [.abs, .hamstrings, .forearms]
let muscles = MuscleGroup.displayOrder.filter { !skip.contains($0) }
var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
for m in muscles { sel[m] = Array(ExerciseBank.exercises(for: m).prefix(2)) }
print("Selected \(muscles.count) muscles:", muscles.map{$0.rawValue}.joined(separator: ", "))
let prog = ProgramGenerator.generate(GeneratorInput(effort: .optimal, days: 6, selections: sel))
for (i,day) in prog.days.enumerated() {
    let sets = day.lifts.reduce(0){$0+$1.sets}
    print("Day \(i+1): \(day.lifts.count) lifts, \(sets) sets")
}
// weekly per-muscle
var wk: [MuscleGroup:Int] = [:]
for d in prog.days { for l in d.lifts { wk[l.exercise.primary, default:0]+=l.sets } }
print("--- weekly sets per muscle (direct) ---")
for m in muscles { print("  \(m.rawValue): \(wk[m] ?? 0)") }

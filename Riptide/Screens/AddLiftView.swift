import SwiftUI
import SwiftData
import RiptideCore

struct AddLiftView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    let day: ProgramDay

    private var programMuscles: [MuscleGroup] { day.program?.muscles ?? MuscleGroup.displayOrder }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    Text("From the exercise library — grouped by the muscles in this program.")
                        .font(.system(size: 13)).foregroundStyle(Theme.textDim)
                    ForEach(programMuscles) { muscle in
                        Text(muscle.label.uppercased()).eyebrow(Theme.accent).padding(.top, 10)
                        ForEach(ExerciseBank.exercises(for: muscle)) { ex in
                            Button {
                                let order = (day.sortedLifts.last?.order ?? -1) + 1
                                let lift = PlannedLift(order: order, exercise: ex, targetSets: 3)
                                lift.day = day
                                context.insert(lift)
                                dismiss()
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(ex.name).font(.system(size: 14, weight: .bold))
                                        Text("\(ex.repRange) reps").font(.system(size: 12)).foregroundStyle(Theme.textFaint)
                                    }
                                    Spacer()
                                    Text("+ Add").font(.system(size: 13, weight: .heavy)).foregroundStyle(Theme.accent)
                                }
                                .padding(13)
                                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.stroke))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(20)
            }
            .background(Theme.bg.ignoresSafeArea())
            .foregroundStyle(Theme.text)
            .navigationTitle("Add a lift")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }.foregroundStyle(Theme.accent)
                }
            }
        }
    }
}

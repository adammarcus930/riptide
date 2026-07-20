import SwiftUI
import SwiftData
import RiptideCore

struct ProgramView: View {
    @Query(filter: #Predicate<Program> { $0.isActive }) private var activePrograms: [Program]
    @State private var renaming = false
    @State private var previousName = ""
    @State private var renameBuffer = ""
    @FocusState private var renameFocus: Bool

    var body: some View {
        ScrollView {
            if let program = activePrograms.first {
                VStack(alignment: .leading, spacing: 16) {
                    Text("ACTIVE PROGRAM").eyebrow(Theme.accent)

                    if renaming {
                        TextField("Name", text: $renameBuffer)
                        .font(.system(size: 34, weight: .heavy))
                        .focused($renameFocus)
                        .onSubmit { commitRename(program) }
                        .onChange(of: renameFocus) { _, focused in
                            if !focused { commitRename(program) }
                        }
                    } else {
                        Button {
                            previousName = program.name
                            renameBuffer = program.name
                            renaming = true
                            renameFocus = true
                        } label: {
                            HStack(spacing: 8) {
                                Text(program.name).font(.system(size: 34, weight: .heavy))
                                Image(systemName: "pencil").font(.system(size: 15)).foregroundStyle(Theme.textFaint)
                            }
                        }
                        .buttonStyle(.plain)
                    }

                    Text("\(program.effort.label) effort · \(program.daysPerWeek) days · \(program.muscles.count) muscle groups")
                        .font(.system(size: 13)).foregroundStyle(Theme.textDim)

                    if !program.shortfallNote.isEmpty {
                        Text(program.shortfallNote)
                            .font(.system(size: 12)).foregroundStyle(Theme.accent.opacity(0.8))
                            .padding(12)
                            .background(Theme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    }

                    ForEach(program.sortedDays, id: \.persistentModelID) { day in
                        NavigationLink(value: DayRef(id: day.persistentModelID)) {
                            dayRow(day, program: program)
                        }
                        .buttonStyle(.plain)
                    }

                    NavigationLink("All programs") { LibraryView() }
                        .font(.system(size: 14, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.strokeStrong))
                        .foregroundStyle(Theme.text.opacity(0.75))
                }
                .padding(20)
            } else {
                VStack(spacing: 12) {
                    Text("No active program").font(.system(size: 20, weight: .heavy))
                    NavigationLink("Program library") { LibraryView() }
                        .buttonStyle(AccentButtonStyle())
                }
                .padding(40)
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .foregroundStyle(Theme.text)
        .navigationDestination(for: DayRef.self) { ref in
            DayDestination(id: ref.id)
        }
    }

    /// Guards the inline rename: the edited text lives in `renameBuffer` and is written through
    /// to `program.name` only here, so an app kill mid-edit can't persist a blank (or partial)
    /// title. Trims and reverts to the pre-edit name if the result is empty. `onSubmit` and the
    /// focus-loss `onChange` can both fire for the same commit, so this is idempotent by way of
    /// the `renaming` early-out rather than by accident.
    private func commitRename(_ program: Program) {
        guard renaming else { return }
        let trimmed = renameBuffer.trimmingCharacters(in: .whitespacesAndNewlines)
        program.name = trimmed.isEmpty ? previousName : trimmed
        renaming = false
    }

    private func dayRow(_ day: ProgramDay, program: Program) -> some View {
        HStack(spacing: 14) {
            Text("\(day.index + 1)")
                .font(.system(size: 17, weight: .heavy))
                .frame(width: 46, height: 46)
                .background(day.completedInCycle ? Theme.accent.opacity(0.14) : Theme.inputBg,
                            in: RoundedRectangle(cornerRadius: 14))
                .foregroundStyle(day.completedInCycle ? Theme.accent : Theme.text)
            VStack(alignment: .leading, spacing: 2) {
                Text(day.focus).font(.system(size: 15, weight: .bold)).lineLimit(1)
                let sets = day.sortedLifts.reduce(0) { $0 + $1.targetSets }
                Text("\(day.sortedLifts.count) lifts · \(sets) sets")
                    .font(.system(size: 12)).foregroundStyle(Theme.textDim)
            }
            Spacer()
            Text(day.completedInCycle ? "DONE" : "")
                .font(.system(size: 10, weight: .heavy)).kerning(1).foregroundStyle(Theme.accent)
        }
        .card()
    }
}

/// Wrapper types keep navigationDestination registrations distinct per model kind
/// (registering PersistentIdentifier twice in one stack is ignored by SwiftUI).
struct DayRef: Hashable { let id: PersistentIdentifier }
struct LiftRef: Hashable { let id: PersistentIdentifier }

/// Resolves a pushed day id to the live model. Replaced target in Task 11.
struct DayDestination: View {
    @Environment(\.modelContext) private var context
    let id: PersistentIdentifier
    var body: some View {
        if let day = context.model(for: id) as? ProgramDay {
            DayDetailView(day: day)
        } else {
            Text("Day not found").foregroundStyle(Theme.textDim)
        }
    }
}

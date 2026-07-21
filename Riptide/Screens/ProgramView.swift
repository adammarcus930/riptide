import SwiftUI
import SwiftData
import RiptideCore

/// Detail for one program — reachable for ANY program (active or not) from the
/// library list, so you can view/edit a program's days without activating it.
struct ProgramDetailView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var allPrograms: [Program]
    @Bindable var program: Program

    @State private var renaming = false
    @State private var previousName = ""
    @State private var renameBuffer = ""
    @State private var confirmingDelete = false
    @FocusState private var renameFocus: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text(program.isActive ? "ACTIVE PROGRAM" : "PROGRAM")
                        .eyebrow(program.isActive ? Theme.accent : Theme.textFaint)
                    Spacer()
                    if !program.isActive {
                        Button("Make active") { makeActive() }
                            .font(.system(size: 12, weight: .heavy))
                            .padding(.horizontal, 13).padding(.vertical, 7)
                            .background(Theme.accent.opacity(0.10), in: Capsule())
                            .overlay(Capsule().stroke(Theme.accent.opacity(0.4)))
                            .foregroundStyle(Theme.accent)
                            .buttonStyle(.plain)
                    }
                }

                if renaming {
                    TextField("Name", text: $renameBuffer)
                        .font(.system(size: 34, weight: .heavy))
                        .focused($renameFocus)
                        .onSubmit { commitRename() }
                        .onChange(of: renameFocus) { _, focused in if !focused { commitRename() } }
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

                ForEach(program.sortedDays, id: \.persistentModelID) { day in
                    NavigationLink(value: DayRef(id: day.persistentModelID)) {
                        dayRow(day)
                    }
                    .buttonStyle(.plain)
                }

                Button(role: .destructive) { confirmingDelete = true } label: {
                    Text("Delete program")
                        .font(.system(size: 14, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.red.opacity(0.4)))
                        .foregroundStyle(.red)
                }
                .buttonStyle(.plain)
                .padding(.top, 8)
            }
            .padding(20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .foregroundStyle(Theme.text)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Delete “\(program.name)”?", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete program and its history", role: .destructive) { deleteProgram() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently removes the program, its days, and every workout logged under it.")
        }
    }

    private func dayRow(_ day: ProgramDay) -> some View {
        HStack(spacing: 14) {
            Text("\(day.index + 1)")
                .font(.system(size: 17, weight: .heavy))
                .frame(width: 46, height: 46)
                .background(day.completedInCycle ? Theme.accent.opacity(0.14) : Theme.inputBg,
                            in: RoundedRectangle(cornerRadius: 14))
                .foregroundStyle(day.completedInCycle ? Theme.accent : Theme.text)
            VStack(alignment: .leading, spacing: 2) {
                Text(day.focus).font(.system(size: 15, weight: .bold)).lineLimit(2)
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

    private func makeActive() {
        for p in allPrograms { p.isActive = false }
        program.isActive = true
    }

    private func deleteProgram() {
        context.delete(program)
        try? context.save()
        dismiss()
    }

    /// Guards the inline rename: edited text lives in `renameBuffer` and is written to
    /// `program.name` only here, so an app kill mid-edit can't persist a blank title.
    /// Idempotent via the `renaming` early-out (onSubmit + focus-loss can both fire).
    private func commitRename() {
        guard renaming else { return }
        let trimmed = renameBuffer.trimmingCharacters(in: .whitespacesAndNewlines)
        program.name = trimmed.isEmpty ? previousName : trimmed
        renaming = false
    }
}

/// Wrapper types keep navigationDestination registrations distinct per model kind
/// (registering PersistentIdentifier twice in one stack is ignored by SwiftUI).
struct ProgramRef: Hashable { let id: PersistentIdentifier }
struct DayRef: Hashable { let id: PersistentIdentifier }
struct LiftRef: Hashable { let id: PersistentIdentifier }

/// Resolves a pushed program id to the live model.
struct ProgramDestination: View {
    @Environment(\.modelContext) private var context
    let id: PersistentIdentifier
    var body: some View {
        if let program = context.model(for: id) as? Program {
            ProgramDetailView(program: program)
        } else {
            Text("Program not found").foregroundStyle(Theme.textDim)
        }
    }
}

/// Resolves a pushed day id to the live model.
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

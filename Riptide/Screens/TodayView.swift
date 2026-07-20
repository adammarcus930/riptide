import SwiftUI
import SwiftData
import RiptideCore

struct TodayView: View {
    @Query(filter: #Predicate<Program> { $0.isActive }) private var activePrograms: [Program]
    @State private var showWizard = false
    var onStartDay: (ProgramDay) -> Void = { _ in }

    private var program: Program? { activePrograms.first }
    private var nextDay: ProgramDay? { program?.sortedDays.first { !$0.completedInCycle } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(alignment: .firstTextBaseline) {
                    Text(Date.now.formatted(.dateTime.weekday(.wide).month().day()).uppercased()).eyebrow()
                    Spacer()
                    Text("RIPTIDE").eyebrow(Theme.accent)
                }
                Text("Train").font(.system(size: 40, weight: .heavy))

                if let program, let day = nextDay {
                    nextUpCard(program: program, day: day)
                    onDeck(day: day)
                    cycleDots(program: program)
                } else if let program {
                    weekComplete(program: program)
                    cycleDots(program: program)
                } else {
                    emptyState
                }
            }
            .padding(20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .foregroundStyle(Theme.text)
        .fullScreenCover(isPresented: $showWizard) { WizardView() }
    }

    private func nextUpCard(program: Program, day: ProgramDay) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("NEXT UP · DAY \(day.index + 1) OF \(program.daysPerWeek)")
                .font(.system(size: 11, weight: .heavy)).kerning(1.2)
            Text(day.focus).font(.system(size: 26, weight: .heavy)).lineSpacing(1)
            let sets = day.sortedLifts.reduce(0) { $0 + $1.targetSets }
            Text("\(day.sortedLifts.count) lifts · \(sets) sets")
                .font(.system(size: 13, weight: .semibold)).opacity(0.65)
            Button("Start day \(day.index + 1)") { onStartDay(day) }
                .font(.system(size: 15, weight: .heavy))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(Theme.onAccent, in: RoundedRectangle(cornerRadius: 14))
                .foregroundStyle(Theme.accent)
                .padding(.top, 10)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(Theme.accent, in: RoundedRectangle(cornerRadius: 22))
        .foregroundStyle(Theme.onAccent)
    }

    private func onDeck(day: ProgramDay) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("ON DECK").eyebrow()
            ForEach(day.sortedLifts.prefix(5), id: \.persistentModelID) { lift in
                HStack {
                    Text(lift.exerciseName).font(.system(size: 14, weight: .bold))
                    Spacer()
                    Text("\(lift.targetSets) × \(lift.repRange)")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textFaint)
                }
                .padding(.horizontal, 14).padding(.vertical, 11)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 13))
                .overlay(RoundedRectangle(cornerRadius: 13).stroke(Theme.stroke))
            }
        }
    }

    private func cycleDots(program: Program) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("THIS CYCLE").eyebrow()
            HStack(spacing: 8) {
                ForEach(program.sortedDays, id: \.persistentModelID) { day in
                    let done = day.completedInCycle
                    let isNext = day.persistentModelID == nextDay?.persistentModelID
                    Button {
                        onStartDay(day)
                    } label: {
                        VStack(spacing: 2) {
                            Text("\(day.index + 1)").font(.system(size: 16, weight: .heavy))
                            Text(done ? "DONE" : isNext ? "NEXT" : "TO GO")
                                .font(.system(size: 9, weight: .bold)).kerning(1)
                                .foregroundStyle(done || isNext ? Theme.accent : Theme.textFaint)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(done ? Theme.accent.opacity(0.10) : Theme.card,
                                    in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14)
                            .stroke(isNext ? Theme.accent : Theme.stroke, lineWidth: isNext ? 1.5 : 1))
                        .foregroundStyle(done ? Theme.accent : Theme.text)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func weekComplete(program: Program) -> some View {
        VStack(spacing: 8) {
            Text("Week complete").font(.system(size: 24, weight: .heavy)).foregroundStyle(Theme.accent)
            Text("Every day in this cycle is logged. Start the next one when you're ready.")
                .font(.system(size: 13)).foregroundStyle(Theme.textDim)
                .multilineTextAlignment(.center)
            Button("Start next cycle") {
                for d in program.sortedDays { d.completedInCycle = false }
            }
            .buttonStyle(AccentButtonStyle())
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .card()
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Build a program around your life.")
                .font(.system(size: 26, weight: .heavy)).lineSpacing(2)
            Text("Tell Riptide how hard you want to push, how many days you have, and what you want to train. It builds the week — you just show up and lift.")
                .font(.system(size: 14)).foregroundStyle(Theme.textDim).lineSpacing(3)
            Button("Build my program") { showWizard = true }
                .buttonStyle(AccentButtonStyle())
                .padding(.top, 10)
        }
        .card()
    }
}

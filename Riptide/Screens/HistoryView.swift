import SwiftUI
import SwiftData

struct HistoryView: View {
    @Query(filter: #Predicate<WorkoutSession> { $0.finishedAt != nil },
           sort: \WorkoutSession.startedAt, order: .reverse)
    private var sessions: [WorkoutSession]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("HISTORY").eyebrow()
                Text("Sessions").font(.system(size: 34, weight: .heavy))
                if sessions.isEmpty {
                    Text("Nothing logged yet — finish a workout and it lands here.")
                        .font(.system(size: 13)).foregroundStyle(Theme.textDim)
                }
                ForEach(sessions, id: \.persistentModelID) { session in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(session.startedAt.formatted(.dateTime.weekday(.wide).month().day()))
                                .font(.system(size: 15, weight: .bold))
                            Spacer()
                            Text("\((session.sets ?? []).count) sets")
                                .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textFaint)
                        }
                        Text("\(session.program?.name ?? "Program") · Day \(session.dayIndex + 1)")
                            .font(.system(size: 12)).foregroundStyle(Theme.textDim)
                    }
                    .card()
                }
            }
            .padding(20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .foregroundStyle(Theme.text)
    }
}

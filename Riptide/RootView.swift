import SwiftUI
import SwiftData

struct RootView: View {
    @Query(filter: #Predicate<WorkoutSession> { $0.finishedAt == nil }) private var openSessions: [WorkoutSession]

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView {
                TodayDestinationHost().tabItem { Label("Today", systemImage: "bolt.fill") }
                NavigationStack { ProgramView() }.tabItem { Label("Program", systemImage: "list.bullet.rectangle") }
                NavigationStack { MoreView() }.tabItem { Label("More", systemImage: "ellipsis.circle") }
            }
            .tint(Theme.accent)

            if let session = openSessions.first {
                HStack(spacing: 12) {
                    Circle().fill(Theme.onAccent).frame(width: 8, height: 8)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("WORKOUT IN PROGRESS").font(.system(size: 9.5, weight: .heavy)).kerning(1)
                        Text("Day \(session.dayIndex + 1) · \(session.program?.name ?? "")")
                            .font(.system(size: 14, weight: .heavy)).lineLimit(1)
                    }
                    Spacer()
                    Text(session.startedAt, style: .timer)
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                }
                .padding(.horizontal, 16).padding(.vertical, 13)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 16))
                .foregroundStyle(Theme.onAccent)
                .padding(.horizontal, 14)
                .padding(.bottom, 58)
            }
        }
        .background(Theme.bg)
        .onChange(of: openSessions.isEmpty, initial: true) { _, isEmpty in
            UIApplication.shared.isIdleTimerDisabled = !isEmpty   // keep-awake during workouts
        }
    }
}

/// Owns the Today tab's own navigation stack so pushing a day detail
/// doesn't nest inside the tab bar's implicit stack.
struct TodayDestinationHost: View {
    @State private var path = NavigationPath()
    var body: some View {
        NavigationStack(path: $path) {
            TodayView { day in path.append(DayRef(id: day.persistentModelID)) }
                .navigationDestination(for: DayRef.self) { ref in
                    DayDestination(id: ref.id)
                }
        }
    }
}

// TEMPORARY placeholder — Task 13 replaces this with the real More screen.
struct MoreView: View {
    var body: some View { Text("More").foregroundStyle(Theme.text) }
}

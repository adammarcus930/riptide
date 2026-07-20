import SwiftUI
import SwiftData

@main
struct RiptideApp: App {
    let container: ModelContainer

    init() {
        do {
            container = try ModelContainer.riptide()
        } catch {
            // Spec §9: visible failure, not silent death.
            fatalError("Failed to open data store: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
        }
        .modelContainer(container)
    }
}

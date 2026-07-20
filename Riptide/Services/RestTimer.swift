import Foundation
import Observation

@Observable
final class RestTimer {
    private(set) var elapsed: TimeInterval = 0
    private(set) var isRunning = false
    private var startedAt: Date?
    private var timer: Timer?

    func start() {
        startedAt = Date()
        elapsed = 0
        isRunning = true
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self, let startedAt = self.startedAt else { return }
            self.elapsed = Date().timeIntervalSince(startedAt)
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        isRunning = false
        elapsed = 0
        startedAt = nil
    }

    var display: String {
        let s = Int(elapsed)
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}

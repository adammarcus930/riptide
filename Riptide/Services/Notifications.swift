import UserNotifications

enum Notifications {
    private static let restID = "rest-alert"

    /// Ask once, quietly; denial just means in-app timer only (spec §9).
    static func requestAuthOnce() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    static func scheduleRestAlert(after seconds: Int) {
        cancelRestAlert()
        let content = UNMutableNotificationContent()
        content.title = "Rest over"
        content.body = "Back under the bar."
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: Double(max(seconds, 1)), repeats: false)
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: restID, content: content, trigger: trigger))
    }

    static func cancelRestAlert() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [restID])
    }
}

import AppIntents
import AppKit
import Foundation

/// Fired by a widget button. Asks the running Volt (over its loopback bridge)
/// to resolve + send the saved request exactly like the Send button does, so
/// environments, auth and scripts all apply and secrets never leave Volt.
/// If Volt isn't running, falls back to `volt://run/<id>`, which launches
/// Volt and runs the request there.
struct RunRequestIntent: AppIntent {
    static var title: LocalizedStringResource = "Run Volt Request"
    static var description = IntentDescription("Sends a saved Volt request.")
    static var isDiscoverable = false

    @Parameter(title: "Request ID")
    var requestId: String

    init() {}

    init(requestId: String) {
        self.requestId = requestId
    }

    func perform() async throws -> some IntentResult {
        if let bridge = WidgetSnapshot.load()?.bridge, await Self.runViaBridge(requestId, bridge) {
            return .result()
        }
        // Volt isn't running (or didn't answer): launch it through the URL
        // scheme; it runs the request once its window is up.
        let encoded = requestId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? requestId
        if let url = URL(string: "volt://run/\(encoded)") {
            _ = await MainActor.run { NSWorkspace.shared.open(url) }
        }
        return .result()
    }

    /// True when Volt answered (the request itself may still have failed —
    /// Volt records that in the snapshot and the widget shows it).
    private static func runViaBridge(_ id: String, _ bridge: WidgetSnapshot.Bridge) async -> Bool {
        guard let url = URL(string: "http://127.0.0.1:\(bridge.port)/run") else { return false }
        var req = URLRequest(url: url, timeoutInterval: 25)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(bridge.token, forHTTPHeaderField: "X-Volt-Widget-Token")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["requestId": id])
        do {
            let (_, response) = try await URLSession.shared.data(for: req)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }
}

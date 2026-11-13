import Foundation

/// Shared with the Electron app (electron/core/widget/bridge.ts). Volt writes
/// `widget.json` into the App Group container; the widget only reads it.
/// The file never contains request URLs, headers or secrets — only display
/// data plus the loopback port/token used to ask a running Volt to send.
enum VoltShared {
    static let appGroup = "2WPVK976M4.dev.volt.shared"

    static var snapshotURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent("widget.json")
    }
}

struct WidgetSnapshot: Codable {
    struct Bridge: Codable {
        var port: Int
        var token: String
    }

    struct LastRun: Codable {
        var ok: Bool
        var status: Int?
        var ms: Double?
        var at: Double
        var error: String?

        var date: Date { Date(timeIntervalSince1970: at / 1000) }
    }

    struct Item: Codable, Identifiable {
        var id: String
        var name: String
        var method: String
        var collection: String?
        var workspace: String?
        var last: LastRun?
        var running: Bool?
    }

    var version: Int
    var updatedAt: Double
    var environment: String?
    var bridge: Bridge?
    var items: [Item]

    static func load() -> WidgetSnapshot? {
        guard let url = VoltShared.snapshotURL,
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    static let placeholder = WidgetSnapshot(
        version: 1,
        updatedAt: Date().timeIntervalSince1970 * 1000,
        environment: "Staging",
        bridge: nil,
        items: [
            Item(id: "1", name: "Login", method: "POST", collection: "Auth",
                 last: LastRun(ok: true, status: 200, ms: 182, at: Date().timeIntervalSince1970 * 1000 - 60_000)),
            Item(id: "2", name: "List requests", method: "GET", collection: "Zendesk",
                 last: LastRun(ok: true, status: 200, ms: 340, at: Date().timeIntervalSince1970 * 1000 - 300_000)),
            Item(id: "3", name: "Health check", method: "GET", collection: "Ops",
                 last: LastRun(ok: false, status: 503, ms: 1204, at: Date().timeIntervalSince1970 * 1000 - 900_000)),
            Item(id: "4", name: "Clear cache", method: "DELETE", collection: "Ops", last: nil),
        ]
    )
}

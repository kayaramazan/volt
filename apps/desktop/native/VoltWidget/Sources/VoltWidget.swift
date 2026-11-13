import SwiftUI
import WidgetKit

struct QuickRunEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct QuickRunProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickRunEntry {
        QuickRunEntry(date: .now, snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickRunEntry) -> Void) {
        let snap = WidgetSnapshot.load()
        completion(QuickRunEntry(date: .now, snapshot: context.isPreview && (snap?.items.isEmpty ?? true) ? .placeholder : snap))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickRunEntry>) -> Void) {
        // Volt reloads the timeline whenever favourites or results change;
        // the periodic refresh only keeps the relative times fresh.
        let entry = QuickRunEntry(date: .now, snapshot: WidgetSnapshot.load())
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(15 * 60))))
    }
}

struct VoltQuickRunWidget: Widget {
    let kind = "VoltQuickRun"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickRunProvider()) { entry in
            QuickRunView(entry: entry)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("Volt Quick Run")
        .description("Send your favourite requests with one click.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main
struct VoltWidgetBundle: WidgetBundle {
    var body: some Widget {
        VoltQuickRunWidget()
    }
}

// MARK: - Views

private let voltYellow = Color(red: 0.98, green: 0.80, blue: 0.08)

struct QuickRunView: View {
    @Environment(\.widgetFamily) private var family
    let entry: QuickRunEntry

    private var capacity: Int {
        switch family {
        case .systemSmall: return 3
        case .systemLarge: return 8
        default: return 4
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemLarge ? 4 : 5) {
            header
            if let items = entry.snapshot?.items, !items.isEmpty {
                let shown = Array(items.prefix(capacity))
                if family == .systemMedium {
                    // 2×2 tiles: four two-line rows don't fit a medium widget.
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 5), GridItem(.flexible(), spacing: 5)], spacing: 5) {
                        ForEach(shown) { item in
                            Button(intent: RunRequestIntent(requestId: item.id)) {
                                RequestTile(item: item)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } else {
                    ForEach(shown) { item in
                        Button(intent: RunRequestIntent(requestId: item.id)) {
                            RequestRow(item: item, compact: family == .systemSmall)
                        }
                        .buttonStyle(.plain)
                    }
                }
                Spacer(minLength: 0)
            } else {
                emptyState
            }
        }
        .widgetURL(URL(string: "volt://open"))
    }

    private var header: some View {
        HStack(spacing: 4) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(voltYellow)
            Text("Volt")
                .font(.system(size: 12, weight: .semibold))
            Spacer(minLength: 4)
            if let env = entry.snapshot?.environment, family != .systemSmall {
                Text(env)
                    .font(.system(size: 10, weight: .medium))
                    .lineLimit(1)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(envColor(env).opacity(0.18), in: Capsule())
                    .foregroundStyle(envColor(env))
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 4) {
            Spacer(minLength: 0)
            Text("No favourites yet")
                .font(.system(size: 12, weight: .semibold))
            Text(entry.snapshot == nil
                 ? "Open Volt once to connect the widget."
                 : "In Volt, open a request's ••• menu → Add to Widget.")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            Spacer(minLength: 0)
        }
    }

    private func envColor(_ name: String) -> Color {
        let n = name.lowercased()
        if n.contains("prod") || n.contains("live") { return .red }
        if n.contains("stag") || n.contains("test") || n.contains("qa") { return .orange }
        return .secondary
    }
}

struct RequestRow: View {
    let item: WidgetSnapshot.Item
    let compact: Bool

    var body: some View {
        HStack(spacing: 6) {
            MethodLabel(method: item.method)
            VStack(alignment: .leading, spacing: 0) {
                Text(item.name)
                    .font(.system(size: compact ? 11 : 12, weight: .medium))
                    .lineLimit(1)
                if !compact, let last = item.last {
                    Text(lastDetail(last))
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .invalidatableContent()
                }
            }
            Spacer(minLength: 2)
            StatusBadge(last: item.last, showCode: !compact)
                .invalidatableContent()
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.quaternary.opacity(0.6), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
        .contentShape(Rectangle())
    }
}

struct RequestTile: View {
    let item: WidgetSnapshot.Item

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 4) {
                MethodLabel(method: item.method)
                Spacer(minLength: 2)
                StatusBadge(last: item.last, showCode: true)
                    .invalidatableContent()
            }
            Text(item.name)
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1)
            Text(item.last.map(lastDetail) ?? "Not run yet")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .invalidatableContent()
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.quaternary.opacity(0.6), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .contentShape(Rectangle())
    }
}

struct MethodLabel: View {
    let method: String

    var body: some View {
        Text(String(method.uppercased().prefix(4)))
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .foregroundStyle(color)
            .frame(width: 28, alignment: .leading)
    }

    private var color: Color {
        switch method.uppercased() {
        case "GET": return .green
        case "POST": return voltYellow
        case "PUT": return .blue
        case "PATCH": return .purple
        case "DELETE": return .red
        default: return .secondary
        }
    }
}

struct StatusBadge: View {
    let last: WidgetSnapshot.LastRun?
    let showCode: Bool

    var body: some View {
        if let last {
            HStack(spacing: 3) {
                Circle().fill(last.ok ? Color.green : Color.red).frame(width: 6, height: 6)
                if showCode {
                    Text(last.status.map(String.init) ?? "ERR")
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(last.ok ? Color.primary : Color.red)
                }
            }
        } else {
            Image(systemName: "play.fill")
                .font(.system(size: 8))
                .foregroundStyle(.secondary)
        }
    }
}

private func lastDetail(_ last: WidgetSnapshot.LastRun) -> String {
    var parts: [String] = []
    if let ms = last.ms { parts.append(ms >= 1000 ? String(format: "%.1fs", ms / 1000) : "\(Int(ms))ms") }
    if let err = last.error, !last.ok, last.status == nil { parts.append(err) }
    parts.append(last.date.formatted(.relative(presentation: .named)))
    return parts.joined(separator: " · ")
}

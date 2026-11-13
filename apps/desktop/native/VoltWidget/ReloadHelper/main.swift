// Tiny helper bundled at Volt.app/Contents/MacOS/volt-widget-reload. Electron
// can't call WidgetKit, so the main process runs this after it rewrites the
// widget snapshot. Living inside the app bundle gives it the app's identity,
// which WidgetCenter uses to find Volt's widgets.
import Foundation
import WidgetKit

WidgetCenter.shared.reloadAllTimelines()
// reloadAllTimelines is fire-and-forget over XPC; give it a moment to flush.
RunLoop.main.run(until: Date().addingTimeInterval(0.3))

import { execFile } from 'node:child_process';

// Zero-dependency OS notifier. Builds a native command per platform and runs it best-effort
// via execFile (NOT a shell string — args are passed as an array, so message text can never
// be interpreted as shell syntax). Fire-and-forget: never blocks, never throws.

// Default runner: spawn detached-ish, ignore stdout/stderr and any error.
function defaultRun(cmd, args) {
  try {
    execFile(cmd, args, () => {}); // callback swallows errors; we don't await
  } catch {
    // execFile can throw synchronously on a bad cmd type — ignore
  }
}

// AppleScript string literals are double-quoted; escape backslashes then double quotes.
function escapeAppleScript(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// PowerShell single-quoted string literals escape a quote by doubling it.
function escapePowerShell(s) {
  return String(s).replace(/'/g, "''");
}

// Windows only shows a desktop toast for an AppUserModelID that has a Start-menu shortcut
// (https://learn.microsoft.com/windows/win32/shell/quickstart-sending-desktop-toast: "If you fail to
// do this, your toast will not be displayed"). The toast is sent from `powershell` (Windows
// PowerShell 5.1), so borrow its registered AUMID; it is listed by Get-StartApps. The GUID is the
// System32 known folder, stable across Windows 10/11.
export const WINDOWS_TOAST_AUMID = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe';

// A self-contained Windows 10+ toast via WinRT, no external module. Best-effort: if WinRT
// isn't available the command simply fails and is ignored.
function windowsToastScript(title, message) {
  const t = escapePowerShell(title);
  const m = escapePowerShell(message);
  return [
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
    "$x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
    "$e = $x.GetElementsByTagName('text')",
    `$e.Item(0).AppendChild($x.CreateTextNode('${t}')) > $null`,
    `$e.Item(1).AppendChild($x.CreateTextNode('${m}')) > $null`,
    "$n = [Windows.UI.Notifications.ToastNotification]::new($x)",
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${escapePowerShell(WINDOWS_TOAST_AUMID)}').Show($n)`,
  ].join('; ');
}

// Show a desktop notification. `platform`/`run` are injectable for tests. Always safe to call.
export function notify(title, message, opts = {}) {
  const { platform = process.platform, run = defaultRun } = opts;
  try {
    if (platform === 'darwin') {
      run('osascript', ['-e', `display notification "${escapeAppleScript(message)}" with title "${escapeAppleScript(title)}"`]);
    } else if (platform === 'win32') {
      run('powershell', ['-NoProfile', '-Command', windowsToastScript(title, message)]);
    } else {
      // Linux and other unixes: notify-send takes title and body as separate arguments.
      run('notify-send', [String(title), String(message)]);
    }
  } catch {
    // Notifications are strictly best-effort; never let one break the caller.
  }
}

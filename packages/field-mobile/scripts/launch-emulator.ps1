param(
    [string]$EmulatorExe = "",
    [string]$AvdName = "core2_api_36",
    [string]$GpuMode = "auto",
    [string]$LogPath = "",
    [string]$Desktop = "WinSta0\Default",
    [string[]]$ExtraArgs = @("-no-snapshot", "-no-audio", "-crash-report-mode", "never"),
    [int]$TargetPid = 0,
    [switch]$CheckVisible,
    [switch]$Wait
)

$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Threading;

public class Win32DesktopLauncher {
    public delegate bool EnumDesktopsDelegate(string desktop, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct SECURITY_ATTRIBUTES {
        public int nLength;
        public IntPtr lpSecurityDescriptor;
        public bool bInheritHandle;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO {
        public Int32 cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public Int32 dwX;
        public Int32 dwY;
        public Int32 dwXSize;
        public Int32 dwYSize;
        public Int32 dwXCountChars;
        public Int32 dwYCountChars;
        public Int32 dwFillAttribute;
        public Int32 dwFlags;
        public Int16 wShowWindow;
        public Int16 cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public Int32 dwProcessId;
        public Int32 dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateProcess(
        string lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation
    );

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern IntPtr CreateFile(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        ref SECURITY_ATTRIBUTES lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile
    );

    [DllImport("kernel32.dll")]
    public static extern uint SetFilePointer(IntPtr hFile, int lDistanceToMove, IntPtr lpDistanceToMoveHigh, uint dwMoveMethod);

    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("user32.dll")]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll")]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    public static int Start(string appExe, string args, string logFile, string desktop) {
        var sa = new SECURITY_ATTRIBUTES();
        sa.nLength = Marshal.SizeOf(sa);
        sa.bInheritHandle = true;
        sa.lpSecurityDescriptor = IntPtr.Zero;

        // dwShareMode: FILE_SHARE_READ (1) | FILE_SHARE_WRITE (2) | FILE_SHARE_DELETE (4)
        // dwCreationDisposition: OPEN_ALWAYS (4)
        IntPtr hLog = CreateFile(logFile, 0x40000000, 1 | 2 | 4, ref sa, 4, 0x80, IntPtr.Zero);
        if (hLog == (IntPtr)(-1)) {
            return -Marshal.GetLastWin32Error();
        }

        // Seek to EOF (FILE_END = 2)
        SetFilePointer(hLog, 0, IntPtr.Zero, 2);

        string deskName = desktop;
        if (!string.IsNullOrEmpty(deskName) && deskName.Contains("\\")) {
            deskName = deskName.Substring(deskName.IndexOf('\\') + 1);
        }
        if (string.IsNullOrEmpty(deskName)) {
            deskName = "Default";
        }

        IntPtr hDesk = OpenDesktop(deskName, 0, false, 0x01FF);

        int spawnedPid = 0;
        int lastErr = 0;

        Thread t = new Thread(() => {
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
            }

            var si = new STARTUPINFO();
            si.cb = Marshal.SizeOf(si);
            si.lpDesktop = string.IsNullOrEmpty(desktop) ? @"WinSta0\Default" : desktop;
            si.dwFlags = 0x00000100; // STARTF_USESTDHANDLES
            si.hStdOutput = hLog;
            si.hStdError = hLog;
            si.hStdInput = IntPtr.Zero;

            var pi = new PROCESS_INFORMATION();
            string cmdLine = "\"" + appExe + "\" " + args;

            uint flags = 0x00000208; // CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS
            bool ok = CreateProcess(null, cmdLine, IntPtr.Zero, IntPtr.Zero, true, flags, IntPtr.Zero, null, ref si, out pi);

            if (!ok) {
                lastErr = Marshal.GetLastWin32Error();
            } else {
                spawnedPid = pi.dwProcessId;
                CloseHandle(pi.hProcess);
                CloseHandle(pi.hThread);
            }
        });

        t.Start();
        t.Join();

        if (hDesk != IntPtr.Zero) {
            CloseDesktop(hDesk);
        }

        CloseHandle(hLog);

        if (spawnedPid <= 0) {
            return -lastErr;
        }

        return spawnedPid;
    }

    public static string FindEmulatorWindow(string desktop, string avdName, int targetPid = 0) {
        string deskName = desktop;
        if (!string.IsNullOrEmpty(deskName) && deskName.Contains("\\")) {
            deskName = deskName.Substring(deskName.IndexOf('\\') + 1);
        }
        if (string.IsNullOrEmpty(deskName)) {
            deskName = "Default";
        }

        // 0x0040 = DESKTOP_ENUMERATE, 0x0001 = DESKTOP_READOBJECTS, 0x0100 = DESKTOP_SWITCHDESKTOP
        IntPtr hDesk = OpenDesktop(deskName, 0, false, 0x0040 | 0x0001 | 0x0100);
        if (hDesk == IntPtr.Zero) return null;

        string bestMatch = null;
        int bestScore = 0;

        EnumDesktopWindows(hDesk, (hWnd, lp) => {
            if (!IsWindowVisible(hWnd)) return true;

            RECT r;
            GetWindowRect(hWnd, out r);
            int width = r.Right - r.Left;
            int height = r.Bottom - r.Top;
            if (width <= 10 || height <= 10) return true;

            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (targetPid > 0 && pid != (uint)targetPid) return true;

            string procName = "";
            try {
                procName = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName;
            } catch {}

            var title = new System.Text.StringBuilder(256);
            GetWindowText(hWnd, title, 256);
            var cls = new System.Text.StringBuilder(256);
            GetClassName(hWnd, cls, 256);

            string t = title.ToString();
            string c = cls.ToString();

            bool isQemuProc = procName.IndexOf("qemu-system", StringComparison.OrdinalIgnoreCase) >= 0 ||
                              procName.IndexOf("emulator", StringComparison.OrdinalIgnoreCase) >= 0;

            bool isAvdTitle = !string.IsNullOrEmpty(avdName) && t.IndexOf(avdName, StringComparison.OrdinalIgnoreCase) >= 0;
            bool isEmulatorTitle = t.IndexOf("Android Emulator", StringComparison.OrdinalIgnoreCase) >= 0;

            if (isQemuProc || isAvdTitle || isEmulatorTitle) {
                int score = 1;
                // Main window (phone frame) has class QWindowIcon and large dimensions (width >= 200, height >= 300)
                if (isEmulatorTitle) score += 10;
                if (isAvdTitle) score += 10;
                if (c.IndexOf("QWindowIcon", StringComparison.OrdinalIgnoreCase) >= 0) score += 5;
                if (width >= 200 && height >= 300) score += 5;

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = string.Format(
                        "{{\"pid\":{0},\"processName\":\"{1}\",\"title\":\"{2}\",\"className\":\"{3}\",\"visible\":true,\"x\":{4},\"y\":{5},\"width\":{6},\"height\":{7}}}",
                        pid,
                        procName.Replace("\"", "\\\""),
                        t.Replace("\"", "\\\""),
                        c.Replace("\"", "\\\""),
                        r.Left, r.Top, width, height
                    );
                }
            }
            return true;
        }, IntPtr.Zero);

        CloseDesktop(hDesk);
        return bestMatch;
    }
}
"@

if ($CheckVisible) {
    $info = [Win32DesktopLauncher]::FindEmulatorWindow($Desktop, $AvdName, $TargetPid)
    if ($info) {
        Write-Output $info
    } else {
        Write-Output '{"visible":false}'
    }
    exit 0
}

if (-not $EmulatorExe) {
    $candidates = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        "$env:LOCALAPPDATA\Android\Sdk"
    )
    foreach ($cand in $candidates) {
        if ($cand -and (Test-Path "$cand\emulator\emulator.exe")) {
            $EmulatorExe = "$cand\emulator\emulator.exe"
            break
        }
    }
}

if (-not $EmulatorExe -or -not (Test-Path $EmulatorExe)) {
    Write-Error "emulator.exe not found."
    exit 1
}

if (-not $LogPath) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $LogPath = Join-Path (Split-Path -Parent $scriptDir) ".emulator.log"
}

$logDir = Split-Path -Parent $LogPath
if ($logDir -and -not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

if (-not $GpuMode -or $GpuMode -eq "auto") {
    if ($env:CORE2_EMULATOR_GPU) {
        $GpuMode = $env:CORE2_EMULATOR_GPU
    } else {
        $isAmd = (Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "AMD|Radeon" })
        if ($isAmd) {
            $GpuMode = "swiftshader"
        } else {
            $GpuMode = "auto"
        }
    }
}

$qemuRunning = Get-Process | Where-Object { $_.ProcessName -match "qemu-system|emulator" }
if (-not $qemuRunning) {
    $avdHome = if ($env:ANDROID_AVD_HOME) { $env:ANDROID_AVD_HOME } else { "$env:USERPROFILE\.android\avd" }
    $avdDir = Join-Path $avdHome "$AvdName.avd"
    if (Test-Path $avdDir) {
        @("hardware-qemu.ini.lock", "multiinstance.lock", "default.lock") | ForEach-Object {
            $lockPath = Join-Path $avdDir $_
            if (Test-Path $lockPath) {
                Remove-Item -Path $lockPath -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

$argList = @("-avd", $AvdName, "-gpu", $GpuMode) + $ExtraArgs
$argString = ($argList | ForEach-Object {
    if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
}) -join ' '

$pidResult = [Win32DesktopLauncher]::Start($EmulatorExe, $argString, $LogPath, $Desktop)
if ($pidResult -le 0) {
    Write-Error "Failed to launch emulator via CreateProcess. Error code: $(- $pidResult)"
    exit 1
}

[PSCustomObject]@{
    success = $true
    pid = $pidResult
    logPath = $LogPath
    desktop = $Desktop
    avdName = $AvdName
} | ConvertTo-Json -Compress

if ($Wait) {
    Start-Sleep -Seconds 3
    Wait-Process -Name "qemu-system-x86_64" -ErrorAction SilentlyContinue
}


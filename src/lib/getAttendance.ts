import type { AttendanceResponse, PunchRecord } from "./attendance";
import { buildApiUrl } from "./attendance";

type FetchResult =
  | { ok: true; records: PunchRecord[]; source: "live" }
  | { ok: false; error: string; hint: string; records: PunchRecord[]; source: "mock" };

/** Sample records for when the API is unreachable (matches real data shape) */
const MOCK_RECORDS: PunchRecord[] = [
  {
    Empcode: "0001",
    Name: "Aditya Raj",
    INTime: "08:12",
    OUTTime: "--:--",
    WorkTime: "00:00",
    OverTime: "00:00",
    BreakTime: "00:00",
    Status: "P",
    DateString: getTodayDMY(),
    Remark: "M-EI",
    Erl_Out: "00:00",
    Late_In: "00:12",
  },
  {
    Empcode: "0002",
    Name: "Priya Singh",
    INTime: "07:55",
    OUTTime: "18:10",
    WorkTime: "10:15",
    OverTime: "00:15",
    BreakTime: "00:00",
    Status: "P",
    DateString: getTodayDMY(),
    Remark: "M-EI-OT",
    Erl_Out: "00:00",
    Late_In: "00:00",
  },
  {
    Empcode: "0003",
    Name: "Rohit Kumar",
    INTime: "--:--",
    OUTTime: "--:--",
    WorkTime: "00:00",
    OverTime: "00:00",
    BreakTime: "00:00",
    Status: "A",
    DateString: getTodayDMY(),
    Remark: "--",
    Erl_Out: "00:00",
    Late_In: "00:00",
  },
  {
    Empcode: "0004",
    Name: "Neha Sharma",
    INTime: "09:02",
    OUTTime: "--:--",
    WorkTime: "00:00",
    OverTime: "00:00",
    BreakTime: "00:00",
    Status: "P",
    DateString: getTodayDMY(),
    Remark: "M-EI",
    Erl_Out: "00:00",
    Late_In: "01:02",
  },
  {
    Empcode: "0005",
    Name: "Vikram Mishra",
    INTime: "07:30",
    OUTTime: "14:00",
    WorkTime: "06:30",
    OverTime: "00:00",
    BreakTime: "00:00",
    Status: "HD",
    DateString: getTodayDMY(),
    Remark: "M-EI",
    Erl_Out: "04:00",
    Late_In: "00:00",
  },
  {
    Empcode: "0006",
    Name: "Anjali Verma",
    INTime: "08:00",
    OUTTime: "--:--",
    WorkTime: "00:00",
    OverTime: "00:00",
    BreakTime: "00:00",
    Status: "P",
    DateString: getTodayDMY(),
    Remark: "M-EI",
    Erl_Out: "00:00",
    Late_In: "00:00",
  },
  {
    Empcode: "0007",
    Name: "Saurav Gupta",
    INTime: "--:--",
    OUTTime: "--:--",
    WorkTime: "00:00",
    OverTime: "00:00",
    BreakTime: "00:00",
    Status: "A",
    DateString: getTodayDMY(),
    Remark: "--",
    Erl_Out: "00:00",
    Late_In: "00:00",
  },
  {
    Empcode: "0008",
    Name: "Megha Pandey",
    INTime: "08:45",
    OUTTime: "--:--",
    WorkTime: "00:00",
    OverTime: "00:00",
    BreakTime: "00:00",
    Status: "P",
    DateString: getTodayDMY(),
    Remark: "M-EI",
    Erl_Out: "00:00",
    Late_In: "00:45",
  },
];

function getTodayDMY(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Fetch attendance records for a date range.
 * Falls back to mock data (with a flag) if the upstream API fails.
 */
export async function fetchAttendance(
  fromDate: Date,
  toDate: Date
): Promise<FetchResult> {
  const apiUrl = buildApiUrl(fromDate, toDate);

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124",
        // Add auth headers here:
        // Authorization: `Bearer ${process.env.BIOMETRIC_API_TOKEN}`,
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: AttendanceResponse = await res.json();
    return {
      ok: true,
      records: data.InOutPunchData ?? [],
      source: "live",
    };
  } catch (err) {
    return {
      ok: false,
      error: `Biometric API unreachable (${err instanceof Error ? err.message : String(err)})`,
      hint: "Add auth headers in src/lib/getAttendance.ts → fetchAttendance(). Using sample data for now.",
      records: MOCK_RECORDS,
      source: "mock",
    };
  }
}

/** Convenience: fetch today only */
export async function fetchTodayAttendance(): Promise<FetchResult> {
  const now = new Date();
  return fetchAttendance(now, now);
}

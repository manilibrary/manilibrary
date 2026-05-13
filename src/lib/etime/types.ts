/**
 * JSON shapes returned by eTimeOffice device / cloud APIs (api.etimeoffice.com).
 * Date strings are DD/MM/YYYY; punch windows use DD/MM/YYYY_HH:mm.
 */

export type EtimeApiEnvelope = {
  Error: boolean;
  Msg: string;
  IsAdmin?: boolean;
};

/** B1 — DownloadInOutPunchData (daily in/out summary; no raw punch required). */
export type EtimeInOutRow = {
  Empcode: string;
  INTime: string;
  OUTTime: string;
  WorkTime: string;
  OverTime: string;
  BreakTime: string;
  Status: string;
  DateString: string;
  Remark: string;
  Erl_Out: string;
  Late_In: string;
  Name: string;
};

export type EtimeInOutResponse = EtimeApiEnvelope & {
  InOutPunchData: EtimeInOutRow[];
};

/** B2 — DownloadPunchDataMCID (raw punches with machine id). */
export type EtimePunchMcidRow = {
  Name: string;
  Empcode: string;
  PunchDate: string;
  M_Flag: string | null;
  mcid: string;
};

export type EtimePunchMcidResponse = EtimeApiEnvelope & {
  PunchData: EtimePunchMcidRow[];
};

/** B3 — DownloadLastPunchData (incremental / last records + cursor). */
export type EtimeLastPunchRow = {
  Name: string;
  Empcode: string;
  PunchDate: string;
  M_Flag: string | null;
  ID: number;
  Table: string;
  EmpcardNo: string;
};

export type EtimeLastPunchResponse = EtimeApiEnvelope & {
  PunchData: EtimeLastPunchRow[];
  MaxRecord?: string;
  TableName?: string;
};

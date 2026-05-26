export interface ServiceStatus {
  name: string;
  description: string;
  load_state: string;       // loaded | not-found | masked
  active_state: string;     // active | inactive | failed | activating | deactivating
  sub_state: string;        // running | exited | dead | failed ...
  unit_file_state: string;  // enabled | disabled | static | masked
  main_pid: number;
  active_enter_ts: string;
  fragment_path: string;
}

export type Action = "start" | "stop" | "restart" | "reload";

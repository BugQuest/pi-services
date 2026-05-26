import type { Action, ServiceStatus } from "./types";

const BASE = "/api";

async function j<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const r = await fetch(input, init);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

export async function listCurated(): Promise<ServiceStatus[]> {
  const data = await j<{ services: ServiceStatus[] }>(`${BASE}/services`);
  return data.services;
}

export async function listAll(): Promise<ServiceStatus[]> {
  const data = await j<{ services: ServiceStatus[] }>(`${BASE}/services/all`);
  return data.services;
}

export async function getOne(name: string): Promise<ServiceStatus> {
  return j<ServiceStatus>(`${BASE}/services/${encodeURIComponent(name)}`);
}

export async function doAction(
  name: string,
  action: Action,
): Promise<{ ok: boolean; message: string }> {
  return j(`${BASE}/services/${encodeURIComponent(name)}/${action}`, {
    method: "POST",
  });
}

export async function getHistory(name: string, lines = 200): Promise<string[]> {
  const data = await j<{ lines: string[] }>(
    `${BASE}/services/${encodeURIComponent(name)}/logs?lines=${lines}`,
  );
  return data.lines;
}

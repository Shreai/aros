export interface AumNodeActivation {
  activationCode: string; machineId: string; nodeName: string;
  operatingSystem: string; architecture: string; runtimeVersion: string;
}
export interface AumNodeHeartbeat {
  runtimeVersion: string; runtimeReachable: boolean;
  models: string[]; tools: string[]; skills: string[]; features: string[];
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
export const validActivation = (value: any): value is AumNodeActivation => value &&
  ['activationCode','machineId','nodeName','operatingSystem','architecture','runtimeVersion'].every((key) => text(value[key]));
export const validHeartbeat = (value: any): value is AumNodeHeartbeat => value && text(value.runtimeVersion)
  && typeof value.runtimeReachable === 'boolean' && texts(value.models) && texts(value.tools) && texts(value.skills) && texts(value.features);

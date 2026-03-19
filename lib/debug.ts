const debugInitFlag = process.env.NEXT_PUBLIC_DEBUG_INIT;

export const isDebugInitEnabled =
  debugInitFlag === "1" || debugInitFlag?.toLowerCase() === "true";

export function debugInit(scope: string, message: string, payload?: unknown) {
  if (!isDebugInitEnabled) return;
  if (payload === undefined) {
    console.debug(`[${scope}] ${message}`);
    return;
  }
  console.debug(`[${scope}] ${message}`, payload);
}


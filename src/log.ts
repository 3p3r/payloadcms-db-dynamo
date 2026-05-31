import createDebug from 'debug'

/** Root debug namespace (no dashes — required by debug's DEBUG matcher). */
export const DEBUG_ROOT = 'payloadcmsDbDynamo'

export const log = (ns: string): ReturnType<typeof createDebug> =>
  createDebug(`${DEBUG_ROOT}:${ns}`)

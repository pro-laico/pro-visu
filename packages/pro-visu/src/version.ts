declare const __TOOL_VERSION__: string | undefined;

export const TOOL_VERSION: string = typeof __TOOL_VERSION__ !== "undefined" ? __TOOL_VERSION__ : "0.0.0-dev";

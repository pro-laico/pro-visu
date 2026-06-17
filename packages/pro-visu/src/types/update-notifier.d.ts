// Minimal local types for update-notifier v7 (the package ships no type declarations). Covers only
// the surface this CLI uses; see https://github.com/yeoman/update-notifier for the full API.
declare module "update-notifier" {
  export interface UpdateNotifierOptions {
    pkg: { name: string; version: string };
    /** How often to check, in ms. Default: 1 day. */
    updateCheckInterval?: number;
    /** Allow the notice to show when run from an npm script. Default: false. */
    shouldNotifyInNpmScript?: boolean;
    /** Which dist-tag to compare against. Default: "latest". */
    distTag?: string;
  }

  export interface UpdateInfo {
    latest: string;
    current: string;
    type: "latest" | "major" | "minor" | "patch" | "prerelease" | "build";
    name: string;
  }

  export interface NotifyOptions {
    /** Defer the notice until the process exits. Default: true. */
    defer?: boolean;
    /** Custom message; supports {packageName} {currentVersion} {latestVersion} {updateCommand}. */
    message?: string;
    /** Include `-g` in the default message's install command. Ignored when `message` is set. */
    isGlobal?: boolean;
    boxenOptions?: Record<string, unknown>;
  }

  export interface Notifier {
    /** Present only when an update is available. */
    update?: UpdateInfo;
    notify(options?: NotifyOptions): void;
    fetchInfo(): Promise<UpdateInfo>;
  }

  export default function updateNotifier(options: UpdateNotifierOptions): Notifier;
}

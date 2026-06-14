// Allow the UnoCSS attributify color-token attribute (`<span text="accent">`) on host elements.
import type {} from "react";

declare module "react" {
  interface HTMLAttributes<T> {
    text?: string;
  }
}

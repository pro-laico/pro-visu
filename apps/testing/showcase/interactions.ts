import type { AssetSpecInput } from "pro-visu";
import { CURSOR } from "./brand";

// Scripted realtime tours with the synthetic cursor — slow + deliberate, in camel.
export const interactions: AssetSpecInput[] = [
  {
    name: "menu", // seamless loop: open the mega-menu, glide a link, return to the button and close
    generator: "interaction",
    options: {
      cursor: { color: CURSOR },
      // Pre-place the cursor on the trigger (off-camera) so frame 0 has no glide-in from center.
      setup: [{ do: "move", selector: "#menu-button", durationMs: 0, holdMs: 0 }],
      actions: [
        { do: "click", selector: "#menu-button", holdMs: 700 }, // open
        { do: "hover", selector: "#menu-panel a", holdMs: 900 }, // glide across a link
        { do: "move", selector: "#menu-button", durationMs: 500, holdMs: 250 }, // travel back
        { do: "click", selector: "#menu-button", holdMs: 900 }, // close → last frame matches the first
      ],
    },
  },
  {
    name: "cart", // quick-add the featured piece, open the cart drawer
    generator: "interaction",
    options: {
      cursor: { color: CURSOR },
      actions: [
        { do: "click", selector: "#feature-card .quick-add", holdMs: 700 },
        { do: "click", selector: "#cart-button", holdMs: 1200 },
      ],
    },
  },
  {
    name: "browse", // shop: eased scroll to "The Edit", then tap through the pieces (phone-sized)
    generator: "interaction",
    url: "/shop",
    options: {
      output: { width: 390, height: 844, deviceScaleFactor: 2 },
      cursor: { color: CURSOR },
      page: { waitForSelector: "#edit-stage img" },
      actions: [
        { do: "scrollTo", to: "#edit", durationMs: 1200, holdMs: 800 },
        { do: "click", selector: ".edit-thumb:nth-child(2)", holdMs: 1400 },
        { do: "click", selector: ".edit-thumb:nth-child(4)", holdMs: 1600 },
      ],
    },
  },
  {
    name: "buy", // PDP buy flow: choose a size, add to bag, drawer slides in
    generator: "interaction",
    url: "/products/the-camel-coat",
    options: {
      cursor: { color: CURSOR },
      actions: [
        { do: "click", selector: ".size-options button:nth-of-type(4)", holdMs: 600 },
        { do: "click", selector: "#pdp-add", holdMs: 1400 },
      ],
    },
  },
];

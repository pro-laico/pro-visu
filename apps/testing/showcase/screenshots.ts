import type { AssetSpecInput } from "pro-visu";

export const screenshots: AssetSpecInput[] = [
  {
    name: "shots",
    generator: "screenshots",
    options: {
      viewports: [
        { name: "desktop", width: 1440, height: 900 },
        { name: "mobile", width: 390, height: 844 },
      ],
      page: { waitForSelector: ".hero-media img" },
      elements: [
        { selector: "#hero", name: "hero" },
        { selector: "#new-arrivals", name: "arrivals" },
      ],
    },
  },
];

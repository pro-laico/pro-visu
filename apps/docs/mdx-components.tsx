import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import type { MDXComponents } from "mdx/types";
import { ConfigOptions } from "@/components/config-options";
import { Example, ImageExample, Showcase } from "@/components/example";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Tabs,
    Tab,
    ConfigOptions,
    Example,
    ImageExample,
    Showcase,
    ...components,
  };
}

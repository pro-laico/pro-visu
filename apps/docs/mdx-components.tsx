import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Example, ImageExample, Showcase } from "@/components/example";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Example,
    ImageExample,
    Showcase,
    ...components,
  };
}

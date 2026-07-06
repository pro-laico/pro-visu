import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";

export const docs = defineDocs({
  dir: "content/docs",
  // `includeProcessedMarkdown` exposes `page.data.getText(...)`, the source the .md /
  // llms.txt routes serve (see lib/llm-markdown.ts, which cleans our components out of it).
  docs: { schema: pageSchema, postprocess: { includeProcessedMarkdown: true } },
  meta: { schema: metaSchema },
});

export default defineConfig();

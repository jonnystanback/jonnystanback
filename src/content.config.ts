import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Each Field Notes issue is one .mdx file in src/content/issues/.
// The file name is the issue number (001.mdx -> /inthefield/001).
const issues = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/issues' }),
  schema: ({ image }) =>
    z.object({
      number: z.string(),              // "001"
      date: z.coerce.date(),           // publish date, shown in the dateline
      location: z.string(),            // "Santa Barbara, CA"
      description: z.string(),         // used for link previews and the archive
      cover: image(),                  // full-bleed cover photo (masthead included)
      coverAlt: z.string(),
      dateImage: image().optional(),   // the date handwritten for the folder tab (transparent PNG)
      draft: z.boolean().default(false),
    }),
});

export const collections = { issues };

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const location = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  place: z.string().optional().default(''),
});

const photo = z.union([
  z.string().min(1),
  z.object({
    src: z.string().min(1),
    alt: z.string().optional(),
    location: location.optional(),
  }),
]);

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().min(1, '제목(title)을 입력해 주세요.'),
    date: z.coerce.date(),
    photos: z.array(photo).default([]),
    location: location.optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };

import { z } from 'zod'

/** Only fields safe to redisplay belong in the browser's setup defaults. */
const formValues = z.object({
  shop: z.string().optional(),
  clientId: z.string().optional(),
  scopes: z.string().optional(),
  redirectUri: z.string().optional(),
})

/** Shared by server rendering and hydration; unknown fields, including secrets, are stripped. */
export const pageDataSchema = z.object({
  title: z.string(),
  description: z.string(),
  status: z.enum(['home', 'setup', 'success', 'error']).default('home'),
  shop: z.string().default(''),
  scopes: z.string().default(''),
  token: z.string().default(''),
  csrf: z.string().default(''),
  values: formValues.default({}),
  message: z.string().default(''),
  recoverable: z.boolean().default(false),
  retryable: z.boolean().default(false),
})

export type PageData = z.output<typeof pageDataSchema>
export type PageInput = z.input<typeof pageDataSchema>

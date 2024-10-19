import "@std/dotenv/load";
import * as z from "zod";

export const EnvSchema = z.object({
  YOUTUBE_API_KEY: z.string(),
  YOUTUBE_CHANNEL_IDS: z.string()
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
    ),
});

export type EnvSchema = z.infer<typeof EnvSchema>;

// deno-lint-ignore prefer-const
let env: EnvSchema;

const { data, error } = EnvSchema.safeParse(Deno.env.toObject());

if (error) {
  console.error(error.issues.flat());
  throw new Error("Invalid env");
}

env = data;

export default env;

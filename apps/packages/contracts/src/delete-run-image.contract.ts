import { z } from 'zod';

export const DeleteRunImageSchema = z.object({
    imageUrl: z.string().url(),
});

export type DeleteRunImageDto =
    z.infer<typeof DeleteRunImageSchema>;

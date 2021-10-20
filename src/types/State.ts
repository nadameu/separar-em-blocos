import { z } from 'zod';
import { isBloco } from './Bloco';

export const isState = z.object({
  aberto: z.boolean(),
  blocos: z.array(isBloco),
});
export type State = z.infer<typeof isState>;

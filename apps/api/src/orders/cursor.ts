import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { OrderSort } from '@sarh/shared';

/**
 * Keyset cursors.
 *
 * A cursor is the sort value plus the tiebreaker id of the last row on the
 * page, base64url-encoded so it reads as opaque to the client. It also carries
 * the sort field it was issued for: pairing a `createdAt` cursor with an
 * `totalAmount` sort would silently return a wrong page, so that is rejected.
 */
const cursorSchema = z.object({
  f: z.enum(['createdAt', 'totalAmount']),
  v: z.string().min(1),
  id: z.string().uuid(),
});

export type DecodedCursor = z.infer<typeof cursorSchema>;

export function encodeCursor(field: OrderSort, value: string, id: string): string {
  return Buffer.from(JSON.stringify({ f: field, v: value, id }), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string, expectedField: OrderSort): DecodedCursor {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('Invalid cursor');
  }

  const result = cursorSchema.safeParse(parsed);
  if (!result.success) {
    throw new BadRequestException('Invalid cursor');
  }

  if (result.data.f !== expectedField) {
    throw new BadRequestException('Cursor does not match the requested sort order');
  }

  return result.data;
}

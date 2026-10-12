import { guestEnabled, json } from './_server';

export const config = { runtime: 'edge' };

export default function handler(): Response {
  return json({ guest: guestEnabled });
}

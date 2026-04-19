import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';

export const loader = async (_: LoaderFunctionArgs) => {
  return json({ status: 'ok', uptime: process.uptime() });
};

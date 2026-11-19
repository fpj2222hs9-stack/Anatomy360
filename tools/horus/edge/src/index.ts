// @ts-nocheck
import { makeHandler } from './core.js';
Deno.serve(makeHandler((k) => Deno.env.get(k)));

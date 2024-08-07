import { Hono } from 'hono';
import type { BlankSchema } from 'hono/types';
import type { HonoTypes } from '../types/hono.type';

export interface Controller {
	// controller: Hono<HonoTypes, BlankSchema, '/'>;
	routes(): Hono<HonoTypes, BlankSchema, '/'>;
}
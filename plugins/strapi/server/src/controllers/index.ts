import type { Core } from '@strapi/strapi';
import margin, { type MarginHandlers } from './margin';

const controllers: Record<string, (deps: { strapi: Core.Strapi }) => MarginHandlers> = { margin };

export default controllers;

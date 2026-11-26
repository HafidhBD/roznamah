import type { TemplateKey } from '@/lib/design';
import type { Template } from '../primitives';
import { modern } from './modern';
import { official } from './official';

export const templates: Record<TemplateKey, Template> = { modern, official };

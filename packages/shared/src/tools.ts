import { z } from 'zod';
import { bodyBlockContentSchema, fieldNameSchema, fieldValueSchema } from './editor-host';

const reasonSchema = z.string().min(1).max(280).describe('One sentence explaining the change.');

export const proposeFieldValueArgsSchema = z.object({
  field: fieldNameSchema.describe('A field name from the host schema.'),
  value: fieldValueSchema.describe('The new value. A list of strings for tags.'),
  reason: reasonSchema,
});
export type ProposeFieldValueArgs = z.infer<typeof proposeFieldValueArgsSchema>;

export const proposeBodyEditArgsSchema = z.object({
  blockId: z.string().min(1).describe('The blockId of the body block to replace.'),
  newContent: bodyBlockContentSchema.describe('The replacement block. Inline marks as Markdown.'),
  reason: reasonSchema,
});
export type ProposeBodyEditArgs = z.infer<typeof proposeBodyEditArgsSchema>;

/** Result the browser sends back after the user answers a proposal. */
export const proposalResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('accepted') }),
  z.object({ status: z.literal('rejected'), reason: z.string().max(500).optional() }),
  z.object({ status: z.literal('stale') }),
]);
export type ProposalResult = z.infer<typeof proposalResultSchema>;

/** Frontend tools: run in the browser, never executed on the server. */
export const frontendTools = {
  proposeFieldValue: {
    description: 'Suggest a new value for one document field. The user must accept it.',
    args: proposeFieldValueArgsSchema,
  },
  proposeBodyEdit: {
    description: 'Suggest a replacement for one block of the body. The user must accept it.',
    args: proposeBodyEditArgsSchema,
  },
} as const;
export type FrontendToolName = keyof typeof frontendTools;

/** AG-UI `Tool` shape: name, description and JSON Schema parameters. */
// A type alias (not an interface) so it fits AG-UI's loose `Tool` record type.
export type ToolDefinition = {
  name: FrontendToolName;
  description: string;
  parameters: Record<string, unknown>;
};

export function frontendToolDefinitions(): ToolDefinition[] {
  return (Object.keys(frontendTools) as FrontendToolName[]).map((name) => ({
    name,
    description: frontendTools[name].description,
    parameters: z.toJSONSchema(frontendTools[name].args),
  }));
}

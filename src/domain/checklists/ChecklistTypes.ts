import { assertIdentifier } from '../maintenance/MaintenanceTypes';
import { ChecklistError } from './ChecklistError';
export interface VerificationDefinition {
  readonly taskId: string;
  readonly taskDescription: string;
  readonly equipmentCategoryId: string;
  readonly equipmentCategoryName: string;
}
export type VerificationStatus =
  'unfilled' | 'completed' | 'problem_found' | 'not_applicable';
export type VerificationInput =
  | { readonly status: 'unfilled' | 'completed' | 'not_applicable' }
  | {
      readonly status: 'problem_found';
      readonly description: string;
      readonly photoReference?: string | null;
      readonly existingProblemId?: string;
    };
export interface VerificationResult {
  readonly status: VerificationStatus;
  readonly description: string | null;
  readonly photoReference: string | null;
  readonly problemId: string | null;
}
export function text(value: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new ChecklistError('INVALID_TEXT');
  return value.trim();
}
export function verificationKey(
  taskId: string,
  equipmentCategoryId: string,
): string {
  assertIdentifier(taskId);
  assertIdentifier(equipmentCategoryId);
  return [taskId, equipmentCategoryId].map(encodeURIComponent).join('/');
}
export function freezeDefinition(
  input: VerificationDefinition,
): VerificationDefinition {
  verificationKey(input.taskId, input.equipmentCategoryId);
  return Object.freeze({
    taskId: input.taskId,
    taskDescription: text(input.taskDescription),
    equipmentCategoryId: input.equipmentCategoryId,
    equipmentCategoryName: text(input.equipmentCategoryName),
  });
}
export function freezeDefinitions(
  inputs: readonly VerificationDefinition[],
): readonly VerificationDefinition[] {
  const definitions = inputs.map(freezeDefinition),
    keys = definitions.map((d) =>
      verificationKey(d.taskId, d.equipmentCategoryId),
    );
  if (new Set(keys).size !== keys.length)
    throw new ChecklistError('DUPLICATE_VERIFICATION');
  return Object.freeze(definitions);
}
export function normalizeInput(input: VerificationInput): VerificationInput {
  if (input.status === 'problem_found') {
    const photoReference = input.photoReference ?? null;
    if (photoReference !== null) assertIdentifier(photoReference);
    if (input.existingProblemId !== undefined)
      assertIdentifier(input.existingProblemId);
    return Object.freeze({
      status: input.status,
      description: text(input.description),
      photoReference,
      ...(input.existingProblemId === undefined
        ? {}
        : { existingProblemId: input.existingProblemId }),
    });
  }
  if (!['unfilled', 'completed', 'not_applicable'].includes(input.status))
    throw new ChecklistError('INVALID_RESULT');
  return Object.freeze({ status: input.status });
}
export function freezeResult(input: VerificationResult): VerificationResult {
  if (input.status === 'problem_found') {
    if (input.problemId === null || input.description === null)
      throw new ChecklistError('INVALID_RESULT');
    assertIdentifier(input.problemId);
    const normalized = normalizeInput({
      status: input.status,
      description: input.description,
      photoReference: input.photoReference,
    });
    if (normalized.status !== 'problem_found')
      throw new ChecklistError('INVALID_RESULT');
    return Object.freeze({
      status: input.status,
      description: normalized.description,
      photoReference: normalized.photoReference ?? null,
      problemId: input.problemId,
    });
  }
  normalizeInput({ status: input.status });
  if (
    input.description !== null ||
    input.photoReference !== null ||
    input.problemId !== null
  )
    throw new ChecklistError('INVALID_RESULT');
  return Object.freeze({
    status: input.status,
    description: null,
    photoReference: null,
    problemId: null,
  });
}
export const unfilledResult: VerificationResult = Object.freeze({
  status: 'unfilled',
  description: null,
  photoReference: null,
  problemId: null,
});

/** Types for the precompiled validator (scripts/gen-validator.mjs). Ajv-style: returns true or sets errors. */
export interface ValidatorError {
  instancePath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}
declare const validate: ((data: unknown) => boolean) & { errors?: ValidatorError[] | null };
export { validate };
export default validate;

/**
 * @file This script generates TypeScript bindings for the Solana program errors.
 *
 * Purpose:
 * - Reads Anchor IDL JSON files from target/idl/*.json
 * - Extracts error definitions from the "errors" field
 * - Generates TypeScript error code constants and types
 * - Outputs to target/types/ as *_errors.ts files
 *
 * Usage:
 * - npm run codegen:errors all          (generates for all programs)
 * - npm run codegen:errors sablier_lockup    (generates for specific program)
 */

import {
  createMainFunction,
  extractIdlField,
  generateFileHeader,
  type IdlError,
  readIdlFile,
  writeGeneratedFile,
} from "./common/codegen-utils";

/**
 * Validates that error definitions have the required fields
 *
 * @param errors - Array of error definitions from the IDL
 * @returns True if all errors are valid
 */
function validateErrors(errors: IdlError[]): boolean {
  return !errors.some((e) => !e.name || !e.code);
}

/**
 * Generates TypeScript error code definitions from IDL error data
 *
 * Creates:
 * 1. ProgramErrorCode constant object mapping error names to codes
 * 2. ProgramErrorName type for type-safe error name usage
 *
 * @param errors - Array of error definitions from the IDL
 * @returns Generated TypeScript content
 */
function generateErrorCode(errors: IdlError[]): string {
  const errorEntries = errors.map(({ name, code }) => `  ${name}: ${code},`);

  const content = [
    ...generateFileHeader(),
    "export const ProgramErrorCode = {",
    ...errorEntries,
    "} as const;",
    "",
    "export type ProgramErrorName = keyof typeof ProgramErrorCode;",
  ];

  return content.join("\n");
}

/**
 * Main function that generates TypeScript error definitions for a single program
 *
 * Process:
 * 1. Read the JSON IDL file from target/idl/{programName}.json
 * 2. Extract and validate the "errors" array
 * 3. Generate TypeScript error code constants and types
 * 4. Write the result to target/types/{programName}_errors.ts
 *
 * @param programName - The name of the program (e.g., "sablier_lockup")
 * @throws Error if the IDL file is malformed or missing errors
 */
function genErrors(programName: string): void {
  const idl = readIdlFile(programName);
  const errors = extractIdlField<IdlError>(idl, "errors", validateErrors);
  const content = generateErrorCode(errors);
  writeGeneratedFile(content, programName, "_errors");
}

const main = createMainFunction(genErrors, "error bindings");

if (require.main === module) {
  main();
}

/**
 * @file This script generates TypeScript bindings for the Solana program struct types.
 *
 * Purpose:
 * - Reads Anchor IDL JSON files from target/idl/*.json
 * - Extracts type definitions (structs and enums) from the "types" field
 * - Converts Rust/Solana types to TypeScript equivalents
 * - Generates clean TypeScript type definitions with camelCase field names
 * - Outputs to target/types/ as *_structs.ts files
 *
 * Usage:
 * - bun run codegen:structs all          (generates for all programs)
 * - bun run codegen:structs sablier_lockup    (generates for specific program)
 */

import _ from "lodash";
import {
  createMainFunction,
  extractIdlField,
  generateFileHeader,
  type IdlType,
  type IdlTypeDefinition,
  readIdlFile,
  writeGeneratedFile,
} from "./common/codegen-utils";

/**
 * Mapping from Rust/Solana primitive types to TypeScript equivalents
 *
 * Type conversion strategy:
 * - Integer types with less than 64 bits → number
 * - Integer types with 64 bits or more → BN (BigNumber)
 * - bool → boolean
 * - pubkey → PublicKey (from @solana/web3.js)
 * - string → string (unchanged)
 *
 * Note: We use BN for all integers to handle Solana's large numbers safely
 */
const RUST_TYPES = {
  bool: "boolean",
  i64: "BN",
  pubkey: "PublicKey",
  u8: "number",
  u32: "number",
  u64: "BN",
  u128: "BN",
} as const;

type RustType = keyof typeof RUST_TYPES;

/**
 * Converts snake_case field names from Rust to camelCase for TypeScript
 *
 * @example
 * - "start_unlock" → "startUnlock"
 * - "deposited_token_mint" → "depositedTokenMint"
 * - "is_cancelable" → "isCancelable"
 */
function convertFieldName(fieldName: string): string {
  return _.camelCase(fieldName);
}

/**
 * Analyzes all types and generates the necessary import statements
 *
 * Scans through all type definitions to determine which external types are needed:
 * - BN: Required for any u64, u128, i64 fields (imported from "bn.js")
 * - PublicKey: Required for any pubkey fields (imported from "@solana/web3.js")
 *
 * This ensures we only import what we actually use, keeping the generated files clean.
 */
function generateImports(types: IdlType[]): string[] {
  const imports: string[] = [];
  let needsBN = false;
  let needsPublicKey = false;

  // Scan through all struct fields to see what types we need to import
  _.forEach(types, (type) => {
    if (type.type.kind !== "struct" || !type.type.fields) {
      return;
    }

    _.forEach(type.type.fields, (field) => {
      const mappedType = mapSolanaTypeToTypeScript(field.type);

      // Check if this field requires external type imports
      if (mappedType === "BN" || mappedType.includes("BN[]")) {
        needsBN = true;
      } else if (mappedType === "PublicKey" || mappedType.includes("PublicKey[]")) {
        needsPublicKey = true;
      }
    });
  });

  // Generate import statements only for types we actually use
  if (needsBN) {
    imports.push('import BN from "bn.js";');
  }
  if (needsPublicKey) {
    imports.push('import { type PublicKey } from "@solana/web3.js";');
  }

  return imports;
}

/**
 * Generates a complete TypeScript type definition from an IDL type
 *
 * Handles two main cases:
 * 1. Enums: Creates union types with string literals
 *    Example: export type StreamStatus = "Pending" | "Streaming" | "Settled";
 *
 * 2. Structs: Creates object types with typed properties
 *    Example: export type Amounts = {
 *               startUnlock: BN;
 *               cliffUnlock: BN;
 *             };
 */
function generateStructType(idlType: IdlType): string {
  if (idlType.type.kind === "enum") {
    // Handle enum types - convert to TypeScript union types with string literals
    // Rust: enum StreamStatus { Pending, Streaming, Settled }
    // TS:   type StreamStatus = "Pending" | "Streaming" | "Settled"
    const variants = idlType.type.variants?.map((variant) => `"${variant.name}"`).join(" | ");
    return `export type ${idlType.name} = ${variants};\n`;
  }

  if (!idlType.type.fields || idlType.type.fields.length === 0) {
    // Skip empty structs (like ClaimReceipt which has no fields)
    return "";
  }

  // Handle struct types - convert each field and create object type
  const fields = idlType.type.fields
    .map((field) => {
      const fieldName = convertFieldName(field.name); // snake_case → camelCase
      const fieldType = mapSolanaTypeToTypeScript(field.type); // Rust type → TS type
      return `  ${fieldName}: ${fieldType};`;
    })
    .join("\n");

  return `export type ${idlType.name} = {\n${fields}\n};\n`;
}

/**
 * Converts Rust/Solana types from the IDL to their TypeScript equivalents
 *
 * Handles three main cases:
 * 1. Primitive types (string): Maps using RUST_TYPES lookup table
 * 2. Custom defined types (object with 'defined' key): References another type in the same file
 * 3. Arrays (object with 'array' key): Converts element type and adds []
 *
 * @param type - The type definition from the IDL
 * @returns The equivalent TypeScript type string
 * @throws Error if an unknown type is encountered
 */
function mapSolanaTypeToTypeScript(type: IdlTypeDefinition): string {
  if (typeof type === "string") {
    // Handle primitive types using RUST_TYPES lookup table
    // If type is not in table, return as-is (assume it's already a valid TS type)
    return RUST_TYPES[type as RustType] || type;
  }

  if (type && _.isObject(type)) {
    if ("defined" in type) {
      // Handle custom defined types (references to other structs/enums in the same IDL)
      // These will be converted to PascalCase when we generate the type definitions
      return type.defined.name;
    } else if ("array" in type) {
      // Handle arrays - convert the element type and add array notation
      const [elementType] = type.array;
      const mappedElementType = mapSolanaTypeToTypeScript(elementType);
      return `${mappedElementType}[]`;
    }
  }

  // If we reach here, it's an unknown type that needs to be added to RUST_TYPES
  throw new Error(`Unknown type: ${JSON.stringify(type)}. Add it to the RUST_TYPES object.`);
}

/* -------------------------------------------------------------------------- */
/*                              MAIN FUNCTIONS                               */
/* -------------------------------------------------------------------------- */

/**
 * Main function that generates TypeScript struct definitions for a single program
 *
 * Process:
 * 1. Read the JSON IDL file from target/idl/{programName}.json
 * 2. Extract the "types" array containing struct and enum definitions
 * 3. Analyze types to determine required imports (BN, PublicKey)
 * 4. Generate TypeScript type definitions for each struct/enum
 * 5. Combine imports and type definitions into a complete file
 * 6. Write the result to target/types/{programName}_structs.ts
 */
function genStructs(programName: string): void {
  // Read and parse the IDL file
  const idl = readIdlFile(programName);

  // Extract and validate type definitions
  const types = extractIdlField<IdlType>(idl, "types");

  // Generate the necessary imports and type definitions
  const imports = generateImports(types);
  const typeDefinitions = types.map(generateStructType).filter(Boolean); // Filter out empty strings

  // Combine everything into a complete TypeScript file
  const content = [...generateFileHeader(imports), ...typeDefinitions].join("\n");

  // Write the generated TypeScript file
  writeGeneratedFile(content, programName, "_structs");
}

/* -------------------------------------------------------------------------- */
/*                                    MAIN                                    */
/* -------------------------------------------------------------------------- */

const main = createMainFunction(genStructs, "struct bindings");

if (require.main === module) {
  main();
}

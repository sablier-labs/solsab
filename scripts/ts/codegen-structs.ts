/**
 * @file This script generates TypeScript bindings for the Solana program struct types.
 *
 * Purpose:
 * - Reads Anchor IDL JSON files from target/idl/
 * - Extracts type definitions (structs and enums) from the "types" field
 * - Converts Rust/Solana types to TypeScript equivalents
 * - Generates clean TypeScript type definitions with camelCase field names
 * - Outputs to target/types/ as *_structs.ts files
 *
 * Usage:
 * - npm run codegen:structs all          (generates for all programs)
 * - npm run codegen:structs sablier_lockup    (generates for specific program)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import _ from "lodash";
import { ProgramName as ProgramNameEnum } from "../../lib/enums";
import { type ProgramName } from "../../lib/types";

// Directory structure for the project
const ROOT_DIR = join(__dirname, "..", "..");
const IDL_DIR = join(ROOT_DIR, "target", "idl"); // Source: Anchor-generated JSON IDL files
const TYPES_DIR = join(ROOT_DIR, "target", "types"); // Output: Generated TypeScript files

// Valid program names that can be processed by this script
const VALID_PROGRAMS = ["all", ..._.values(ProgramNameEnum)];

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */

/**
 * Represents the possible type definitions in an Anchor IDL
 *
 * Can be one of:
 * - string: Primitive type like "u64", "bool", "pubkey"
 * - { defined: { name: string } }: Reference to another type in the same IDL
 * - { array: [string, number] }: Array type with element type and size
 */
type IdlTypeDefinition = string | { defined: { name: string } } | { array: [string, number] };

/**
 * Represents a field in an Anchor IDL type definition
 * - name: The field name in snake_case (as it appears in Rust)
 * - type: The type definition for this field
 */
type IdlField = {
  name: string;
  type: IdlTypeDefinition;
};

/**
 * Represents a complete type definition from the Anchor IDL
 * - name: The type name (will be converted to PascalCase)
 * - type.kind: Either "struct" for objects or "enum" for union types
 * - type.fields: Array of fields for structs (undefined for enums)
 * - type.variants: Array of variant names for enums (undefined for structs)
 */
type IdlType = {
  name: string;
  type: {
    kind: "struct" | "enum";
    fields?: IdlField[];
    variants?: { name: string }[];
  };
};

/**
 * Mapping from Rust/Solana primitive types to TypeScript equivalents
 *
 * Type conversion strategy:
 * - All integer types (u8, u16, u32, u64, u128, i8, i16, i32, i64, i128) → BN (BigNumber)
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
  u8: "number", // Small integers can stay as number
  u64: "BN", // Large integers need BN
  u128: "BN", // Large integers need BN
} as const;

type RustType = keyof typeof RUST_TYPES;

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
    return `export type ${idlType.name} = ${variants};`;
  }

  if (!idlType.type.fields) {
    // Handle empty structs (like ClaimReceipt which has no fields)
    // These become empty object types: export type ClaimReceipt = {};
    return `export type ${idlType.name} = {};`;
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
  for (const type of types) {
    if (type.type.kind === "struct" && type.type.fields) {
      for (const field of type.type.fields) {
        const mappedType = mapSolanaTypeToTypeScript(field.type);

        // Check if this field requires external type imports
        if (mappedType === "BN") {
          needsBN = true;
        } else if (mappedType === "PublicKey") {
          needsPublicKey = true;
        }

        // Handle array types that might contain BN or PublicKey
        if (mappedType.includes("BN[]")) {
          needsBN = true;
        } else if (mappedType.includes("PublicKey[]")) {
          needsPublicKey = true;
        }
      }
    }
  }

  // Generate import statements only for types we actually use
  if (needsBN) {
    imports.push('import BN from "bn.js";');
  }
  if (needsPublicKey) {
    imports.push('import { type PublicKey } from "@solana/web3.js";');
  }

  return imports;
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
function genStructs(programName: string) {
  // Read the Anchor-generated IDL JSON file
  const idlPath = join(IDL_DIR, `${programName}.json`);
  const { types } = JSON.parse(readFileSync(idlPath, { encoding: "utf-8" }));

  // Validate that the IDL has the expected structure
  if (!_.isArray(types)) {
    throw new Error("IDL incorrectly formatted - types field missing or not an array");
  }

  // Generate the necessary imports and type definitions
  const imports = generateImports(types);
  const typeDefinitions = types.map(generateStructType);

  // Combine everything into a complete TypeScript file
  const lines = [
    "// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.",
    "",
    ...imports,
    "",
    ...typeDefinitions,
  ].join("\n");

  // Write the generated TypeScript file
  const structsPath = join(TYPES_DIR, `${programName}_structs.ts`);
  writeFileSync(structsPath, lines);
}

/**
 * Entry point of the script - handles command line arguments and orchestrates generation
 *
 * Supports two modes:
 * 1. Generate for all programs: npm run codegen:structs all
 * 2. Generate for specific program: npm run codegen:structs sablier_lockup
 *
 * Validates input and provides helpful error messages for invalid usage.
 */
function main() {
  // Parse command line arguments
  const programName = process.argv[2] as ProgramName | "all";

  // Validate program name
  if (!programName || !VALID_PROGRAMS.includes(programName)) {
    console.error(`❌ Missing or Invalid program name: ${programName}`);
    console.error(`📋 Valid options: ${VALID_PROGRAMS.join(", ")}`);
    process.exit(1);
  }

  // Generate structs for the specified program(s)
  if (programName === "all") {
    // Generate for all supported programs
    genStructs(ProgramNameEnum.Lockup);
    genStructs(ProgramNameEnum.MerkleInstant);
    console.log("✔️ Successfully generated struct bindings for all programs\n");
  } else {
    // Generate for a specific program
    genStructs(programName);
    console.log(`✔️ Successfully generated struct bindings for ${programName}\n`);
  }
}

// Execute main function if this script is run directly (not imported)
if (require.main === module) {
  main();
}

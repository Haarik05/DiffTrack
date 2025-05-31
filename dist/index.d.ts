/**
 * Schema that tells the diff engine how to match items in arrays of objects.
 * For each array field, you can specify which property to use as the unique identifier.
 */
export interface DiffSchema {
    [fieldName: string]: {
        /** e.g. 'id', 'signatoryId', 'accountNumber' */
        arrayItemIdentifier: string;
    };
}
export declare class DiffChecker {
    private schema;
    private ignored;
    constructor(config?: {
        schema?: DiffSchema;
        ignoreKeys?: Array<any>;
    });
    private detectCircularReference;
    /**
     * Main entry point: compares two objects and returns only the differences.
     */
    callDiffTracker(previousValue: Record<string, any>, latestValue: Record<string, any>, parentObject: Record<string, any>): Promise<{
        status: "SUCCESS" | "ERROR";
        message: string;
        data: Record<string, any>;
    } | {
        status: "SUCCESS" | "ERROR";
        message: string;
        data: null;
    }>;
    private checkDifference;
    /**
     * Handles arrays of objects or primitives.
     * For objects, uses schema-driven identifiers to compute differences.
     * For primitives, computes additions and deletions as change objects.
     */
    private handleArrays;
    /**
     * Computes differences for arrays of objects using an identifier.
     * Returns an array of changes (additions, deletions, modifications).
     */
    private getArrayOfObjectDiff;
    private handleObjectToNullChange;
    private handleNullToObjectChange;
    private isIgnoredKey;
    private normalizeString;
    private log;
    private responseObj;
}

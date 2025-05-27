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

/**
 * Allows users to plug in completely custom comparison logic for specific array fields.
 */
export type ArrayHandlerConfig = {
  [key: string]: (prevArr: any[], newArr: any[]) => Promise<any> | any;
};

export class KycDiffChecker {
  // private arrayHandlers: ArrayHandlerConfig;
  private schema: DiffSchema;
  private ignored: Array<string>;

  constructor(config?: {
    arrayHandlers?: ArrayHandlerConfig;
    schema?: DiffSchema;
    ignoreKeys?: Array<any>;
  }) {
    // this.arrayHandlers = config?.arrayHandlers || {};
    this.schema = config?.schema || {};
    this.ignored = config?.ignoreKeys || [];
  }

  /**
   * Main entry point: compares two objects and returns only the differences.
   */
  async checkDifference(
    requestId: string,
    previousValue: Record<string, any>,
    latestValue: Record<string, any>,
    parentObject: Record<string, any> = {},
    seen: WeakSet<any> = new WeakSet()
  ): Promise<Record<string, any>> {
    this.log("Initiated checkDifference");

    if (seen.has(previousValue) || seen.has(latestValue)) {
      this.log("Circular reference detected. Skipping...");
      return parentObject;
    }

    seen.add(previousValue);
    seen.add(latestValue);

    const allKeys = Array.from(
      new Set([...Object.keys(previousValue), ...Object.keys(latestValue)])
    );

    for (const key of allKeys) {
      if (this.isIgnoredKey(key)) continue;
      const prev = previousValue[key];
      const latest = latestValue[key];
      console.log("the key ->", key);
      // Array of objects
      if (Array.isArray(prev) && Array.isArray(latest)) {
        const diffed = await this.handleArrays(requestId, prev, latest, key);
        if (
          diffed &&
          (Array.isArray(diffed)
            ? diffed.length > 0
            : Object.keys(diffed).length > 0)
        ) {
          parentObject[key] = diffed;
        }
      } else if (prev && typeof prev === "object" && latest == null) {
        this.handleObjectToNullChange(key, previousValue, parentObject);
      } else if (prev == null && latest && typeof latest === "object") {
        this.handleNullToObjectChange(key, latestValue, parentObject);

        // Nested object
      } else if (
        prev &&
        typeof prev === "object" &&
        latest &&
        typeof latest === "object"
      ) {
        const nested = await this.checkDifference(requestId, prev, latest, {} ,seen);
        this.log(`*********** CHECK DIFFERENCE CALLED ************`);
        if (Object.keys(nested).length) parentObject[key] = nested;

        // Addition
      } else if (!prev && latest) {
        this.log(" **** addition ****");
        parentObject[key] = {
          mannerOfChange: "ADDITION",
          initialValue: "-",
          latestValue: latest,
        };

        // Deletion
      } else if (!latest && prev) {
        this.log(" **** Deletion ****");
        parentObject[key] = {
          mannerOfChange: "DELETION",
          initialValue: prev,
          latestValue: "-",
        };

        // Modification (primitive)
      } else if (prev?.toString().trim() !== latest?.toString().trim()) {
        this.log(" **** Modification ****");
        parentObject[key] = {
          mannerOfChange: "MODIFICATION",
          initialValue: prev,
          latestValue: latest,
        };
      }
    }

    return parentObject;
  }

  /**
   * Handles arrays of objects, using a custom handler if provided, or the default diff.
   */
  private async handleArrays(
    requestId: string,
    prevArr: any[],
    newArr: any[],
    key: string
  ): Promise<any> {
    this.log(`handleArrayOfObjects for ${key}`);

    // check whether it is array of objects

    if (typeof prevArr?.[0] === "object" && typeof newArr?.[0] === "object") {
      // Custom handling functions are temporarily disabled.
      // const custom = this.arrayHandlers[key];
      // if (custom) return await custom(prevArr, newArr);

      // 2) schema-driven identifier
      const identifier = this.schema[key]?.arrayItemIdentifier;
      console.log("The identifier --->>>>", identifier);
      return await this.getArrayOfObjectDiff(
        requestId,
        prevArr,
        newArr,
        identifier
      );
    } else {
      // handle the primitive types by converting everything to string

      const oldData =
        prevArr.map((data) => this.normalizeString(data?.toString())) ?? [];
      const newData =
        newArr.map((data) => this.normalizeString(data?.toString())) ?? [];

      const deletions = oldData.filter((element) => {
        if (!newData.includes(element)) {
          return {
            mannerOfChange: "DELETION",
            initialValue: element,
            latestValue: "-",
          };
        }
      });

      const addition = newData.filter((element) => {
        if (!oldData.includes(element)) {
          return {
            mannerOfChange: "ADDITION",
            initialValue: "-",
            latestValue: element,
          };
        }
      });

      const changes = [...addition, ...deletions];
      return changes;
    }
  }

  /**
   * Default diff for arrays of objects.
   * If identifier is provided, matches by that field and recurses for modifications;
   * otherwise falls back to JSON.stringify-based add/delete.
   */
  private async getArrayOfObjectDiff(
    requestId: string,
    prevArr: any[],
    newArr: any[],
    identifier: string,
  ): Promise<any[]> {
    const changes: any[] = [];

    const oldMap = new Map(prevArr.map((item) => [item[identifier], item]));
    const newMap = new Map(newArr.map((item) => [item[identifier], item]));

    // additions & modifications
    for (const [id, newItem] of newMap) {
      if (!oldMap.has(id)) {
        changes.push({
          arrayItemIdentifier: id,
          mannerOfChange: "ADDITION",
          latestValue: newItem,
        });
      } else {
        const oldItem = oldMap.get(id);
        const nestedDiff = await this.checkDifference(
          requestId,
          oldItem,
          newItem
        );

        if (Object.keys(nestedDiff).length) {
          changes.push({
            arrayItemIdentifier: id,
            difference: nestedDiff,
          });
        }
      }
    }

    // deletions
    for (const [id, oldItem] of oldMap) {
      if (!newMap.has(id)) {
        changes.push({
          id,
          mannerOfChange: "DELETION",
          initialValue: oldItem,
        });
      } else {
        const newItem = newMap.get(id);
        const nestedDiff = await this.checkDifference(
          requestId,
          oldItem,
          newItem
        );

        if (Object.keys(nestedDiff).length) {
          changes.push({
            arrayItemIdentifier: id,
            difference: nestedDiff,
          });
        }
      }
    }

    return changes;
  }

  private handleObjectToNullChange(
    key: string,
    previousValue: Record<string, any>,
    parentObject: Record<string, any>
  ) {
    this.log(`Initiated handleObjectToNullChange`);
    this.log(`the key is: ${key}`);

    const prevObj = previousValue[key];
    this.log(`prevObj ${JSON.stringify(prevObj)}`);
    this.log(`Parent object: ${JSON.stringify(parentObject)}`);
    const nested: Record<string, any> = {};
    for (const sub of Object.keys(prevObj)) {
      this.log(`sub key is: ${sub}`);
      if (typeof prevObj[sub] === "object") {
        this.handleObjectToNullChange(sub, prevObj, nested);
        parentObject[key] = nested;
        return parentObject;
      } else if (!!prevObj[sub]) {
        nested[sub] = {
          mannerOfChange: "DELETION",
          initialValue: prevObj[sub],
          latestValue: "-",
        };
      }

      this.log(`Nested value present: ${JSON.stringify(nested)}`);
    }

    if (Object.keys(nested).length) {
      parentObject[key] = nested;
    }
    this.log(
      `Nested value present after assinging to parent: ${JSON.stringify(
        parentObject
      )}`
    );
    return parentObject;
  }

  private handleNullToObjectChange(
    key: string,
    latestValue: Record<string, any>,
    parentObject: Record<string, any>
  ) {
    this.log(`Initiated handleNullToObjectChange`);
    const newObj = latestValue[key] || {};
    const nested: Record<string, any> = {};
    for (const sub of Object.keys(newObj)) {
      if (typeof newObj[sub] === "object") {
        this.handleNullToObjectChange(sub, newObj, nested);
        parentObject[key] = nested;
        return parentObject;
      } else if (!!newObj[sub])
        nested[sub] = {
          mannerOfChange: "ADDITION",
          initialValue: "-",
          latestValue: newObj[sub],
        };
    }
    if (Object.keys(nested).length) {
      parentObject[key] = nested;
    }

    return parentObject;
  }

  isIgnoredKey(key: string): boolean {
    return this.ignored.includes(key);
  }

  private normalizeString(str: string) {
    return str.replace(/\s+/g, "").trim(); // Remove the spaces inbetween.
  }
  private log(message: string) {
    console.log(`${message}`);
  }

  private logError(requestId: string, message: string) {
    console.error(`[${requestId}] ${message}`);
  }
}

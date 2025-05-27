/**
 * Allows users to plug in completely custom comparison logic for specific array fields.
 */
// export type ArrayHandlerConfig = {
//   [key: string]: (prevArr: any[], newArr: any[]) => Promise<any> | any;
// };
export class KycDiffChecker {
    // private arrayHandlers: ArrayHandlerConfig;
    schema;
    ignored;
    nestedDetectCircular = true;
    constructor(config) {
        // this.arrayHandlers = config?.arrayHandlers || {};
        this.schema = config?.schema || {};
        this.ignored = config?.ignoreKeys?.map((d) => String(d)) || [];
    }
    async detectCircularReference(obj, seen) {
        if (obj && typeof obj === "object") {
            if (seen.has(obj)) {
                throw new Error(`Circular reference detected`);
            }
            seen.add(obj);
            for (const key of Object.keys(obj)) {
                await this.detectCircularReference(obj[key], seen);
            }
        }
        // seen.delete(obj);
    }
    /**
     * Main entry point: compares two objects and returns only the differences.
     */
    async callDiffTracker(previousValue, latestValue, parentObject) {
        try {
            this.log(`Initiated callDiffTracker`);
            const data = await this.checkDifference(previousValue, latestValue, parentObject);
            return this.responseObj("SUCCESS", `Successfully found difference`, data);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.responseObj("ERROR", `Errored in callDiffTracker with message: ${errorMessage}`, null);
        }
    }
    async checkDifference(previousValue, latestValue, parentObject = {}) {
        this.log("Initiated checkDifference");
        try {
            if (this.nestedDetectCircular) {
                await this.detectCircularReference(previousValue, new WeakSet());
                await this.detectCircularReference(latestValue, new WeakSet());
                this.nestedDetectCircular = false;
            }
            const allKeys = Array.from(new Set([...Object.keys(previousValue), ...Object.keys(latestValue)]));
            for (const key of allKeys) {
                if (this.isIgnoredKey(key))
                    continue;
                const prev = previousValue[key];
                const latest = latestValue[key];
                // Array of objects
                if (Array.isArray(prev) && Array.isArray(latest)) {
                    const diffed = await this.handleArrays(prev, latest, key, parentObject);
                    if (diffed &&
                        (Array.isArray(diffed)
                            ? diffed.length > 0
                            : Object.keys(diffed).length > 0)) {
                        parentObject[key] = diffed;
                    }
                }
                else if (prev && typeof prev === "object" && latest == null) {
                    await this.handleObjectToNullChange(key, previousValue, parentObject);
                }
                else if (prev == null && latest && typeof latest === "object") {
                    await this.handleNullToObjectChange(key, latestValue, parentObject);
                    // Nested object
                }
                else if (prev &&
                    typeof prev === "object" &&
                    latest &&
                    typeof latest === "object") {
                    const nested = await this.checkDifference(prev, latest, {});
                    this.log(`*********** CHECK DIFFERENCE CALLED ************`);
                    if (Object.keys(nested).length)
                        parentObject[key] = nested;
                    // Addition
                }
                else if (!prev && latest) {
                    parentObject[key] = {
                        mannerOfChange: "ADDITION",
                        initialValue: "-",
                        latestValue: latest,
                    };
                    // Deletion
                }
                else if (!latest && prev) {
                    parentObject[key] = {
                        mannerOfChange: "DELETION",
                        initialValue: prev,
                        latestValue: "-",
                    };
                    // Modification (primitive)
                }
                else if (prev?.toString().trim() !== latest?.toString().trim()) {
                    parentObject[key] = {
                        mannerOfChange: "MODIFICATION",
                        initialValue: prev,
                        latestValue: latest,
                    };
                }
            }
            return parentObject;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(errorMessage);
        }
    }
    /**
     * Handles arrays of objects, using a custom handler if provided, or the default diff.
     */
    async handleArrays(prevArr, newArr, key, parentObject) {
        this.log(`handleArrayOfObjects for ${key}`);
        // check whether it is array of objects
        if (typeof prevArr?.[0] === "object" && typeof newArr?.[0] === "object") {
            // Custom handling functions are temporarily disabled.
            // const custom = this.arrayHandlers[key];
            // if (custom) return await custom(prevArr, newArr);
            // 2) schema-driven identifier
            const identifier = this.schema[key]?.arrayItemIdentifier;
            return await this.getArrayOfObjectDiff(prevArr, newArr, identifier
            // parentObject
            );
        }
        else {
            // handle the primitive types by converting everything to string
            const oldData = prevArr.map((data) => this.normalizeString(data?.toString())) ?? [];
            const newData = newArr.map((data) => this.normalizeString(data?.toString())) ?? [];
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
    async getArrayOfObjectDiff(prevArr, newArr, identifier) {
        const changes = [];
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
            }
            else {
                const oldItem = oldMap.get(id);
                const nestedDiff = await this.checkDifference(oldItem, newItem);
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
            }
            else {
                const newItem = newMap.get(id);
                const nestedDiff = await this.checkDifference(oldItem, newItem);
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
    async handleObjectToNullChange(key, previousValue, parentObject) {
        this.log(`Initiated handleObjectToNullChange`);
        const prevObj = previousValue[key];
        const nested = {};
        for (const sub of Object.keys(prevObj)) {
            if (prevObj[sub] && typeof prevObj[sub] === "object") {
                this.handleObjectToNullChange(sub, prevObj, nested);
                parentObject[key] = nested;
                return parentObject;
            }
            else if (!!prevObj[sub]) {
                nested[sub] = {
                    mannerOfChange: "DELETION",
                    initialValue: prevObj[sub],
                    latestValue: "-",
                };
            }
        }
        if (Object.keys(nested).length) {
            parentObject[key] = nested;
        }
        return parentObject;
    }
    async handleNullToObjectChange(key, latestValue, parentObject) {
        this.log(`Initiated handleNullToObjectChange: ${key}`);
        const newObj = latestValue[key] || {};
        const nested = {};
        for (const sub of Object.keys(newObj)) {
            if (newObj[sub] && typeof newObj[sub] === "object") {
                this.handleNullToObjectChange(sub, newObj, nested);
                parentObject[key] = nested;
                return parentObject;
            }
            else if (!!newObj[sub]) {
                nested[sub] = {
                    mannerOfChange: "ADDITION",
                    initialValue: "-",
                    latestValue: newObj[sub],
                };
            }
        }
        if (Object.keys(nested).length) {
            parentObject[key] = nested;
        }
        return parentObject;
    }
    isIgnoredKey(key) {
        return this.ignored.includes(key);
    }
    normalizeString(str) {
        return str.replace(/\s+/g, "").trim(); // Remove the spaces inbetween.
    }
    log(message) {
        console.log(`${message}`);
    }
    logError(message) {
        console.error(`${message}`);
    }
    responseObj(status, message, data) {
        return {
            status,
            message,
            data,
        };
    }
}

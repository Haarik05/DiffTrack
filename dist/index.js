/**
 * Schema that tells the diff engine how to match items in arrays of objects.
 * For each array field, you can specify which property to use as the unique identifier.
 */
export class DiffEngine {
    schema;
    ignored;
    constructor(config) {
        this.schema = config?.schema || {};
        this.ignored = config?.ignoreKeys?.map((d) => String(d)) || [];
    }
    detectCircularReference(obj, seen) {
        if (obj && typeof obj === "object") {
            if (seen.has(obj)) {
                throw new Error(`Circular reference detected`);
            }
            seen.add(obj);
            for (const key of Object.keys(obj)) {
                this.detectCircularReference(obj[key], seen);
            }
        }
    }
    /**
     * Main entry point: compares two objects and returns only the differences.
     */
    async callDiffTracker(previousValue, latestValue, parentObject) {
        try {
            this.log(`Initiated callDiffTracker`);
            // Check for circular references
            this.detectCircularReference(previousValue, new WeakSet());
            this.detectCircularReference(latestValue, new WeakSet());
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
            const allKeys = Array.from(new Set([...Object.keys(previousValue), ...Object.keys(latestValue)]));
            for (const key of allKeys) {
                if (this.isIgnoredKey(key))
                    continue;
                const prev = previousValue[key];
                const latest = latestValue[key];
                // Array of objects or primitives
                if (Array.isArray(prev) && Array.isArray(latest)) {
                    const diffed = await this.handleArrays(prev, latest, key);
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
                }
                else if (prev &&
                    typeof prev === "object" &&
                    latest &&
                    typeof latest === "object") {
                    const nested = await this.checkDifference(prev, latest, {});
                    this.log(`*********** CHECK DIFFERENCE CALLED ************`);
                    if (Object.keys(nested).length)
                        parentObject[key] = nested;
                }
                else if (!prev && latest) {
                    parentObject[key] = {
                        mannerOfChange: "ADDITION",
                        initialValue: "-",
                        latestValue: latest,
                    };
                }
                else if (!latest && prev) {
                    parentObject[key] = {
                        mannerOfChange: "DELETION",
                        initialValue: prev,
                        latestValue: "-",
                    };
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
     * Handles arrays of objects or primitives.
     * For objects, uses schema-driven identifiers to compute differences.
     * For primitives, computes additions and deletions as change objects.
     */
    async handleArrays(prevArr, newArr, key) {
        this.log(`handleArrays for ${key}`);
        if (typeof prevArr?.[0] === "object" && typeof newArr?.[0] === "object") {
            const identifier = this.schema[key]?.arrayItemIdentifier;
            if (!identifier)
                throw new Error(`Please provide the unique identifier to detect the changes in the array`);
            return await this.getArrayOfObjectDiff(prevArr, newArr, identifier);
        }
        else {
            const oldData = prevArr.map((data) => this.normalizeString(data?.toString())) ?? [];
            const newData = newArr.map((data) => this.normalizeString(data?.toString())) ?? [];
            const deletions = oldData
                .filter((element) => !newData.includes(element))
                .map((element) => ({
                mannerOfChange: "DELETION",
                initialValue: element,
                latestValue: "-",
            }));
            const additions = newData
                .filter((element) => !oldData.includes(element))
                .map((element) => ({
                mannerOfChange: "ADDITION",
                initialValue: "-",
                latestValue: element,
            }));
            return [...additions, ...deletions];
        }
    }
    /**
     * Computes differences for arrays of objects using an identifier.
     * Returns an array of changes (additions, deletions, modifications).
     */
    async getArrayOfObjectDiff(prevArr, newArr, identifier) {
        this.log(`Initiated getArrayOfObjectDiff`);
        const changes = [];
        const oldMap = new Map(prevArr.map((item) => [item[identifier], item]));
        const newMap = new Map(newArr.map((item) => [item[identifier], item]));
        // Additions & modifications
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
        // Deletions
        for (const [id, oldItem] of oldMap) {
            if (!newMap.has(id)) {
                changes.push({
                    arrayItemIdentifier: id,
                    mannerOfChange: "DELETION",
                    initialValue: oldItem,
                });
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
                await this.handleObjectToNullChange(sub, prevObj, nested);
                parentObject[key] = nested;
                return parentObject;
            }
            else if (prevObj[sub]) {
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
                await this.handleNullToObjectChange(sub, newObj, nested);
                parentObject[key] = nested;
                return parentObject;
            }
            else if (newObj[sub]) {
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
        return str.replace(/\s+/g, "").trim();
    }
    log(message) {
        console.log(`${message}`);
    }
    responseObj(status, message, data) {
        return {
            status,
            message,
            data,
        };
    }
}

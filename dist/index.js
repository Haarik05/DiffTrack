export class KycDiffChecker {
    // private arrayHandlers: ArrayHandlerConfig;
    schema;
    ignored;
    constructor(config) {
        // this.arrayHandlers = config?.arrayHandlers || {};
        this.schema = config?.schema || {};
        this.ignored = config?.ignoreKeys || [];
    }
    /**
     * Main entry point: compares two objects and returns only the differences.
     */
    async checkDifference(requestId, previousValue, latestValue, parentObject = {}, seen = new WeakSet()) {
        this.log("Initiated checkDifference");
        if (seen.has(previousValue) || seen.has(latestValue)) {
            this.log("Circular reference detected. Skipping...");
            return parentObject;
        }
        seen.add(previousValue);
        seen.add(latestValue);
        const allKeys = Array.from(new Set([...Object.keys(previousValue), ...Object.keys(latestValue)]));
        for (const key of allKeys) {
            if (this.isIgnoredKey(key))
                continue;
            const prev = previousValue[key];
            const latest = latestValue[key];
            console.log("the key ->", key);
            // Array of objects
            if (Array.isArray(prev) && Array.isArray(latest)) {
                const diffed = await this.handleArrays(requestId, prev, latest, key);
                if (diffed &&
                    (Array.isArray(diffed)
                        ? diffed.length > 0
                        : Object.keys(diffed).length > 0)) {
                    parentObject[key] = diffed;
                }
            }
            else if (prev && typeof prev === "object" && latest == null) {
                this.handleObjectToNullChange(key, previousValue, parentObject);
            }
            else if (prev == null && latest && typeof latest === "object") {
                this.handleNullToObjectChange(key, latestValue, parentObject);
                // Nested object
            }
            else if (prev &&
                typeof prev === "object" &&
                latest &&
                typeof latest === "object") {
                const nested = await this.checkDifference(requestId, prev, latest, {}, seen);
                this.log(`*********** CHECK DIFFERENCE CALLED ************`);
                if (Object.keys(nested).length)
                    parentObject[key] = nested;
                // Addition
            }
            else if (!prev && latest) {
                this.log(" **** addition ****");
                parentObject[key] = {
                    mannerOfChange: "ADDITION",
                    initialValue: "-",
                    latestValue: latest,
                };
                // Deletion
            }
            else if (!latest && prev) {
                this.log(" **** Deletion ****");
                parentObject[key] = {
                    mannerOfChange: "DELETION",
                    initialValue: prev,
                    latestValue: "-",
                };
                // Modification (primitive)
            }
            else if (prev?.toString().trim() !== latest?.toString().trim()) {
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
    async handleArrays(requestId, prevArr, newArr, key) {
        this.log(`handleArrayOfObjects for ${key}`);
        // check whether it is array of objects
        if (typeof prevArr?.[0] === "object" && typeof newArr?.[0] === "object") {
            // Custom handling functions are temporarily disabled.
            // const custom = this.arrayHandlers[key];
            // if (custom) return await custom(prevArr, newArr);
            // 2) schema-driven identifier
            const identifier = this.schema[key]?.arrayItemIdentifier;
            console.log("The identifier --->>>>", identifier);
            return await this.getArrayOfObjectDiff(requestId, prevArr, newArr, identifier);
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
    async getArrayOfObjectDiff(requestId, prevArr, newArr, identifier) {
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
                const nestedDiff = await this.checkDifference(requestId, oldItem, newItem);
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
                const nestedDiff = await this.checkDifference(requestId, oldItem, newItem);
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
    handleObjectToNullChange(key, previousValue, parentObject) {
        this.log(`Initiated handleObjectToNullChange`);
        this.log(`the key is: ${key}`);
        const prevObj = previousValue[key];
        this.log(`prevObj ${JSON.stringify(prevObj)}`);
        this.log(`Parent object: ${JSON.stringify(parentObject)}`);
        const nested = {};
        for (const sub of Object.keys(prevObj)) {
            this.log(`sub key is: ${sub}`);
            if (typeof prevObj[sub] === "object") {
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
            this.log(`Nested value present: ${JSON.stringify(nested)}`);
        }
        if (Object.keys(nested).length) {
            parentObject[key] = nested;
        }
        this.log(`Nested value present after assinging to parent: ${JSON.stringify(parentObject)}`);
        return parentObject;
    }
    handleNullToObjectChange(key, latestValue, parentObject) {
        this.log(`Initiated handleNullToObjectChange`);
        const newObj = latestValue[key] || {};
        const nested = {};
        for (const sub of Object.keys(newObj)) {
            if (typeof newObj[sub] === "object") {
                this.handleNullToObjectChange(sub, newObj, nested);
                parentObject[key] = nested;
                return parentObject;
            }
            else if (!!newObj[sub])
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
    isIgnoredKey(key) {
        return this.ignored.includes(key);
    }
    normalizeString(str) {
        return str.replace(/\s+/g, "").trim(); // Remove the spaces inbetween.
    }
    log(message) {
        console.log(`${message}`);
    }
    logError(requestId, message) {
        console.error(`[${requestId}] ${message}`);
    }
}

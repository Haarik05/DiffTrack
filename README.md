# DiffEngine

**DiffEngine** is a lightweight and schema-driven utility to compare JavaScript/JSON objects and identify field-level differences. It is built to work seamlessly with deeply nested structures, including arrays of objects — perfect for tracking changes in user profiles, KYC forms, account records, and more.

## ✨ Features

* 🔍 Deep comparison of nested JSON objects
* 🧐 Schema-based detection of array changes using unique identifiers
* 🗂️ Highlights additions, deletions, and modifications
* 📦 Useful for audit trails, change tracking, and version diffs

---

## 📦 Installation

```bash
npm install diffengine
```

---

## 🚀 Quick Start

```ts
import {DiffEngine, DiffSchema} from 'diffengine';

const oldData = {
  store: {
    phoneNumber: {
      code: '46',
      number: '4340XXX'
    }
  },
  SignatoryData: [
    {
      fullName: 'Jacquelyn Durgan Anita',
      address: '-'
    }
  ],
  status: 'APPLICATION_SUBMITTED'
};

const newData = {
  SignatoryData: [
    {
      fullName: 'Jacquelyn Durgan Anita',
      address: '6'
    }
  ]
};

// Schema to guide comparison
const schema: DiffSchema = {
  SignatoryData: {
    arrayItemIdentifier: 'fullName'
  }
};

const diff = new DiffEngine({schema});
const result = await diff.callDiffTracker(oldData, newData, new Object);
console.log(JSON.stringify(result));
```

---

## 🧠 Schema Design

When comparing arrays of objects, DiffEngine needs to know **which property uniquely identifies each item**. You define this using a schema.

### 🔧 Schema Format

```ts
export interface DiffSchema {
  [fieldName: string]: {
    /** Unique identifier for array items (e.g. 'id', 'email', 'accountNumber') */
    arrayItemIdentifier: string;
  };
}
```

### 🗞️ Example

```ts
const schema: DiffSchema = {
  users: {
    arrayItemIdentifier: 'email'
  },
  signatories: {
    arrayItemIdentifier: 'signatoryId'
  }
};
```

---


---

## 🧠 🚫 Ignoring Keys
DiffEngine supports an ignoreKeys option — a list of keys to omit entirely from comparison. This is helpful for ignoring fields like timestamps, metadata, or any property that should not trigger a diff.

### 🗞️ Example

```ts
const diff = new DiffEngine({ schema, ignoreKeys: ['updatedAt', 'lastModified'] });
```
---

## 📄 Output Structure

DiffEngine returns a detailed breakdown of changes:

```json
{
  "status": "SUCCESS",
  "message": "Successfully found difference",
  "data": {
    "store": {
      "phoneNumber": {
        "code": {
          "mannerOfChange": "DELETION",
          "initialValue": "46",
          "latestValue": "-"
        },
        "number": {
          "mannerOfChange": "DELETION",
          "initialValue": "4340XXX",
          "latestValue": "-"
        }
      }
    },
    "SignatoryData": [
      {
        "arrayItemIdentifier": "Jacquelyn Durgan Anita",
        "difference": {
          "address": [
            {
              "mannerOfChange": "ADDITION",
              "initialValue": "-",
              "latestValue": "6"
            }
          ]
        }
      }
    ],
    "status": {
      "mannerOfChange": "DELETION",
      "initialValue": "APPLICATION_SUBMITTED",
      "latestValue": "-"
    }
  }
}
```

### Change Types

* `"ADDITION"` – a field was added in the latest object
* `"DELETION"` – a field was removed
* `"MODIFICATION"` – a field value changed

---

## 🚲 Use Cases

* KYC form diff tracking
* Profile or onboarding flow audits
* Change logs in admin portals
* Version control for structured user data

---

## 🤝 Contributing

Feel free to open issues, suggest improvements, or submit pull requests! All contributions are welcome.

---

## 📜 License

MIT License

---

Built with ❤️ to track what matters in your data.

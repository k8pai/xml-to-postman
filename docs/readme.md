# item_detail Interface Specification

This document describes the XML interface specification for managing `item_detail` objects in the **Inventory** domain. The schema defines CRUD operations (Create, Read, Update, Delete) and additional list/fetch utilities.

---

## 📌 Structure

### `<ns:interface>`
- **Attributes:**
  - `xmlns:ns`: XML namespace (`http://example.org/prod`)
  - `name`: Interface name (`item_detail`)
  - `db_schema_name`: Database schema (`'INVENTORY'`)
  - `package`: Logical package grouping (`some.sample.package.inventory`)
- **Purpose:** Declares the interface and its scope.

---

### `<method>`
- **Attributes:**
  - `name`: Method name (`fetch`, `add`, `modify`, `delete`, `undelete`, `list`)
  - `transactional`: Indicates whether the method modifies data (`true` or `false`)
  - `http_method`: Maps to HTTP verbs (`GET`, `POST`, `PUT`)
- **Purpose:** Represents one operation of the interface.

---

### `<documentation>`
- Free-text description.
- Contains:
  - **Inputs**: Expected fields
  - **Outputs**: Returned objects
  - **Description**: Method purpose
  - **Errors**: Expected error scenarios

---

### `<query_param>`
- **Attributes:**
  - `namespace`: Namespace for primitive data types (e.g., `http://example_primitives.com`)
  - `name`: Parameter name (`org_id`, `item_identifier`, etc.)
  - `mandatory`: Optional attribute (`true`/`false`)
- **Purpose:** Declares input query parameters for filtering or identification.

---

### `<input>`
- **Attributes:**
  - `namespace`: Namespace for composite object definitions
  - `name`: Object name (`item_detail`)
- **Purpose:** Declares complex input types (used for `add`, `modify`, `delete`, `undelete`).

---

### `<output>`
- **Attributes:**
  - `namespace`: Namespace for composite output objects
  - `name`: Output name (`item_detail`, `item_details`)
- **Purpose:** Declares expected response object.

---

## 📌 Methods Overview

| Method    | HTTP | Transactional | Input Params / Body                  | Output        | Description                                     |
|-----------|------|---------------|--------------------------------------|---------------|-------------------------------------------------|
| `fetch`   | GET  | No            | `org_id`, `item_identifier`          | `item_detail` | Retrieve a single item by identifier            |
| `add`     | POST | Yes           | `item_detail` (body)                 | None          | Add a new item                                  |
| `modify`  | PUT  | Yes           | `item_detail` (body)                 | None          | Update an existing item                         |
| `delete`  | PUT  | Yes           | `item_detail` (body)                 | None          | Mark an item as deleted                         |
| `undelete`| PUT  | Yes           | `item_detail` (body)                 | None          | Restore a previously deleted item               |
| `list`    | GET  | Yes           | Query params (name, category, etc.)  | `item_details`| List items matching given filter criteria       |

---

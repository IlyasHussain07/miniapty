# Backend API & Database Overview

## API Endpoints

### Auth

#### POST `/auth/signup`
- **Description:** Register a new user.
- **Payload:**
  ```json
  {
    "email": "string (email)",
    "password": "string (min 8 chars)"
  }
  ```
- **Response:** JWT token and user info.

#### POST `/auth/login`
- **Description:** Log in an existing user.
- **Payload:**
  ```json
  {
    "email": "string (email)",
    "password": "string"
  }
  ```
- **Response:** JWT token and user info.

---

### Walkthroughs

#### GET `/walkthroughs/assigned`
- **Description:** Get walkthroughs assigned to the current user.
- **Auth:** Required (JWT)
- **Response:** List of walkthroughs.

#### GET `/walkthroughs`
- **Description:** List walkthroughs for a given origin (and optional path).
- **Auth:** Required (JWT)
- **Query Params:**
  - `origin` (required): string (URL)
  - `path` (optional): string
- **Response:** List of walkthroughs.

#### POST `/walkthroughs`
- **Description:** Create a new walkthrough (authors only).
- **Auth:** Required (JWT, author role)
- **Payload:**
  ```json
  {
    "title": "string",
    "origin": "string (URL)",
    "pathPattern": "string",
    "steps": [ ... ]
  }
  ```
- **Response:** Created walkthrough object.

#### GET `/walkthroughs/:id`
- **Description:** Get a specific walkthrough by ID (owner or assignee only).
- **Auth:** Required (JWT)
- **Response:** Walkthrough object.

#### PUT `/walkthroughs/:id`
- **Description:** Update a walkthrough (owner only).
- **Auth:** Required (JWT)
- **Payload:** Partial walkthrough fields (except origin).
- **Response:** Updated walkthrough object.

#### DELETE `/walkthroughs/:id`
- **Description:** Delete a walkthrough (owner only).
- **Auth:** Required (JWT)
- **Response:** 204 No Content.

#### PUT `/walkthroughs/:id/assignments`
- **Description:** Assign a walkthrough to users (authors only).
- **Auth:** Required (JWT, author role)
- **Payload:**
  ```json
  {
    "userIds": ["string (UUID)"]
  }
  ```
- **Response:** Updated walkthrough with assignments.

---

## Database Structure

### users
- **id:** string (UUID, PK)
- **email:** string (unique)
- **password_hash:** string
- **role:** string ('user' or 'author')
- **is_active:** boolean
- **created_at:** timestamp

### walkthroughs
- **id:** string (UUID, PK)
- **user_id:** string (FK to users)
- **title:** string
- **origin:** string (URL)
- **path_pattern:** string
- **steps:** string (JSON array)
- **created_at:** timestamp
- **updated_at:** timestamp

### walkthrough_assignments
- **id:** string (UUID, PK)
- **walkthrough_id:** string (FK to walkthroughs)
- **assignee_id:** string (FK to users)
- **created_at:** timestamp

---

**Notes:**
- All endpoints requiring authentication expect a JWT token in the Authorization header.
- Walkthrough steps are stored as a JSON array in the `steps` field.
- Only users with the 'author' role can create or assign walkthroughs.

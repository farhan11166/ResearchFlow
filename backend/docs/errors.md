# ResearchFlow — Debugging & Errors Log

A masterlist of the errors encountered during development, why they happened, and how they were fixed. This is your personal troubleshooting guide.

---

## Table of Contents
1. [Phase 1: Foundation Errors](#phase-1-foundation-errors)
2. [Phase 2: File Upload & PDF Errors](#phase-2-file-upload--pdf-errors)

---

## Phase 1: Foundation Errors

### 1. PrismaClientInitializationError
**Error:** `PrismaClient needs to be constructed with a non-empty, valid PrismaClientOptions`
**Why it happened:** Prisma 7 changed how databases connect. It removed `url = env("DATABASE_URL")` from the schema and now requires passing a "driver adapter" explicitly to the Prisma Client constructor.
**The Fix:** Use `@prisma/adapter-pg` and the `pg` package to create a connection pool, wrap it in the Prisma adapter, and pass it to `super({ adapter })` inside the `PrismaService`.

### 2. UnknownDependenciesException
**Error:** `Nest can't resolve dependencies of the AuthService (PrismaService, ?). Please make sure that the argument JwtService at index [1] is available.`
**Why it happened:** The `AuthService` constructor required `JwtService`, but the `AuthModule` didn't import the `JwtModule`.
**The Fix:** Add `JwtModule.register({...})` inside the `imports: []` array of the `AuthModule`.

---

## Phase 2: File Upload & PDF Errors

### 3. Floating Decorators (TypeScript Error)
**Error:** `Unable to resolve signature of property decorator when called as an expression.`
**Why it happened:** Decorators like `@UseGuards()` and `@Post()` were written at the bottom of the controller class, but the actual method they were supposed to decorate (e.g., `async uploadFile()`) was missing. TypeScript tried to apply them to nothing.
**The Fix:** Always ensure a class method immediately follows the decorator stack.

### 4. Prisma Method Typo
**Error:** `Property 'saveDocument' does not exist on type 'DocumentsService'` or Syntax errors near `prisma.document`.
**Why it happened:** Wrote `await this.prisma.document.({ data: ... })` instead of `await this.prisma.document.create({ data: ... })`.
**The Fix:** Added the missing `.create()` method call.

### 5. Missing File in Multer (Postman Error)
**Error:** `No file uploaded` (File was undefined in the controller).
**Why it happened:** The `FileInterceptor('file')` expects the form field key to be exactly `file`. In Postman, if the key is misspelled, or if the type isn't set to "File", Multer silently ignores it.
**The Fix:** Ensure the Postman form-data key exactly matches the string passed to `FileInterceptor` and that the type dropdown is set to "File".

### 6. Malformed Part Header (Postman Error)
**Error:** `Multipart: Malformed part header`
**Why it happened:** Manually adding a `Content-Type: multipart/form-data` header in Postman. Postman requires a unique `boundary` string to parse multipart data correctly, which it only auto-generates if you **don't** set the header manually.
**The Fix:** Delete the manual `Content-Type` header in Postman and let it generate automatically when sending form-data.

### 7. Foreign Key Constraint Violation (Prisma P2003)
**Error:** `insert or update on table "Document" violates foreign key constraint "Document_workspaceId_fkey"`
**Why it happened:** Hardcoded `workspaceId: 'default'` when creating a document, but no workspace with the ID "default" existed in the `Workspace` table.
**The Fix:** Made `workspaceId` optional (`String?`) in the schema, generated a migration, and passed `null` until the Workspaces feature was built.

### 8. Package Breaking Change (pdf-parse)
**Error:** `TypeError: pdfParse is not a function`
**Why it happened:** A classic NPM package trap. The standard `pdf-parse` is version `1.1.1`. A new author took over the package and published `2.4.5` which completely changed the code to an ESM Class structure, breaking the standard `pdfParse(buffer)` usage.
**The Fix:** Downgraded the package strictly to the stable version: `npm install pdf-parse@1.1.1`.

### 9. Null Body Fields in Multipart Requests
**Error:** `workspaceId` was returning `null`/undefined even though it was sent in Postman's form-data.
**Why it happened:** Multer processes `multipart/form-data` as a stream from top to bottom. In Postman, the `file` field was placed at the top of the list, so Multer read the file and fired the controller *before* parsing the text fields below it.
**The Fix:** In Postman, always drag text fields (like `workspaceId`) to the rows **above** the file field.

### 10. Forgetting to Pass Controller Arguments
**Error:** `workspaceId` was saving as null despite being correctly parsed.
**Why it happened:** Extracted `@Body('workspaceId') workspaceId` in the controller method signature, but forgot to pass it as the third argument to `this.documentsService.saveDocument(file, req.user.id)`.
**The Fix:** Pass the variable: `this.documentsService.saveDocument(file, req.user.id, workspaceId)`.

---

## Phase 3 & 4: AI Pipeline Errors

### 11. Malformed Google API URL (Trailing Whitespace)
**Error:** `[404 Not Found] models/... is not found for API version v1beta`
**Why it happened:** The Google SDK attaches the API key to the query string (`?key=...`). If the `.env` file has a hidden trailing space or newline after the key, it corrupts the URL completely.
**The Fix:** Always call `.trim()` on environment variables used in URLs: `new GoogleGenerativeAI(apiKey.trim())`.

### 12. Deprecated / Unlisted AI Models
**Error:** `[404 Not Found] models/gemini-1.5-flash is not found`
**Why it happened:** Google constantly updates model names (`text-embedding-004` -> `gemini-embedding-2`, `gemini-1.5-flash` -> `gemini-3.5-flash`) based on the age of the API key and region.
**The Fix:** Use a script to query `https://generativelanguage.googleapis.com/v1beta/models` directly to see the exact model strings available to the specific API key.

### 13. Strict TypeScript Null Checks (Qdrant Payload)
**Error:** `match.payload is possibly 'null' or 'undefined'.`
**Why it happened:** Qdrant returns vector matches with an optional `payload` (metadata) object. TypeScript refuses to let you do `match.payload.text` because the payload might not exist.
**The Fix:** Use optional chaining: `match.payload?.text`.

### 14. Prisma Foreign Key Constraint (P2003)
**Error:** `Foreign key constraint violated on the constraint: Chat_workspaceId_fkey`
**Why it happened:** Tried to create a `Chat` linked to a `workspaceId` (`cmqpodfp...`) that did not actually exist in the Postgres `Workspace` table. Because the database enforces strict referential integrity, it blocked the insert.
**The Fix:** Ensure the parent record exists first! Create a Workspace, grab its real ID, and pass that ID into the Chat creation request.

### 15. Invisible URL Characters in Postman (404 Not Found)
**Error:** `"Cannot POST /chat/.../message%0A"` (404 Not Found)
**Why it happened:** When copying an ID from a JSON response and pasting it into the Postman URL bar, an invisible "Enter/Newline" character was accidentally copied. Browsers and Postman URL-encode this character as `%0A`, appending it to the route and breaking the endpoint path.
**The Fix:** Click at the very end of the URL in Postman and hit Backspace to delete any hidden line breaks.

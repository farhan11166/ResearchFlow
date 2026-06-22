# ResearchFlow — Internals

How THIS project is structured — file connections, request flows, and implementation details.
This file is your reference for **understanding HOW the project is built**.

---

## Table of Contents
1. [Project Structure](#project-structure)
2. [Module Dependency Tree](#module-dependency-tree)
3. [How Files Are Connected](#how-files-are-connected)
4. [Request Lifecycle Traces](#request-lifecycle-traces)
5. [Prisma Setup (Prisma 7 Specifics)](#prisma-setup-prisma-7-specifics)
6. [Environment Variables](#environment-variables)

---

## Project Structure

```
ResearchFlow/
├── plan.md                        ← 8-week roadmap checklist
├── learning.md                    ← Concepts explained
├── internals.md                   ← This file
│
└── backend/
    ├── prisma.config.ts           ← Prisma 7 config (DB URL for migrations)
    ├── prisma/
    │   ├── schema.prisma          ← Data models definition
    │   └── migrations/            ← Auto-generated SQL migration history
    │
    └── src/
        ├── main.ts                ← Entry point
        ├── app.module.ts          ← Root module
        │
        ├── prisma/
        │   ├── prisma.module.ts   ← Global DB module
        │   └── prisma.service.ts  ← DB connection + Prisma client
        │
        ├── auth/
        │   ├── auth.module.ts     ← Auth module wiring
        │   ├── auth.controller.ts ← HTTP route handlers
        │   ├── auth.service.ts    ← Business logic (signup, login)
        │   ├── auth.dto.ts        ← Request validation shapes
        │   ├── jwt.strategy.ts    ← Token validation logic
        │   └── jwt-auth.guard.ts  ← Route protection gate
        │
        ├── ai/
        │   ├── ai.module.ts
        │   ├── ai.service.ts      ← Gemini Embeddings, Chunking, Qdrant
        │   └── ai.processor.ts    ← BullMQ background worker
        │
        ├── chat/
        │   ├── chat.module.ts
        │   ├── chat.controller.ts ← POST /chat/new, POST /chat/:id/message
        │   └── chat.service.ts    ← Prisma logic for Chat/Message memory
        │
        ├── documents/
        │   ├── documents.module.ts
        │   ├── documents.controller.ts  ← Multer upload logic
        │   └── documents.service.ts     ← PDF parsing, drops job into Redis
        │
        └── workspaces/
            ├── workspaces.module.ts
            ├── workspaces.controller.ts
            ├── workspaces.service.ts
            └── workspaces.dto.ts
```

---

## Module Dependency Tree

```text
AppModule
  ├── imports: BullModule.forRoot() (Redis Connection)
  ├── PrismaModule (@Global)
  │     └── provides: PrismaService ──────────────────────┐
  │                                                        │ (auto-injected everywhere)
  ├── AuthModule                                           │
  │     ├── imports: PassportModule                        │
  │     ├── imports: JwtModule                             │
  │     │     └── provides: JwtService                     │
  │     ├── controllers: AuthController                    │
  │     │     └── injects: AuthService                     │
  │     └── providers:                                     │
  │           ├── AuthService                              │
  │           │     ├── injects: PrismaService ◄───────────┤
  │           │     └── injects: JwtService                │
  │           └── JwtStrategy                              │
  │                 └── injects: PrismaService ◄───────────┤
  ├── AiModule                                             │
  │     ├── imports: BullModule.registerQueue()            │
  │     └── providers:                                     │
  │           ├── AiService                                │
  │           └── AiProcessor (Queue Consumer)             │
  ├── DocumentsModule                                      │
  │     ├── imports: AiModule                              │
  │     ├── imports: BullModule.registerQueue()            │
  │     ├── controllers: DocumentsController               │
  │     │     └── injects: DocumentsService                │
  │     └── providers: DocumentsService                    │
  │                 ├── injects: PrismaService ◄───────────┤
  │                 └── injects: Queue ('document-processing')
  ├── ChatModule                                           │
  │     ├── imports: AiModule                              │
  │     ├── controllers: ChatController                    │
  │     │     └── injects: ChatService, AiService          │
  │     └── providers: ChatService                         │
  │                 └── injects: PrismaService ◄───────────┤
  └── WorkspacesModule                                     │
        ├── controllers: WorkspacesController              │
        │     └── injects: WorkspacesService               │
        └── providers: WorkspacesService                   │
                    └── injects: PrismaService ◄───────────┘
```

---

## How Files Are Connected

### `main.ts` → Everything
```typescript
import 'dotenv/config';           // 1. Load .env FIRST before anything else
import { NestFactory } from ...;
import { AppModule } from ...;

const app = NestFactory.create(AppModule);   // 2. Boot the entire module tree
app.useGlobalPipes(new ValidationPipe(...)); // 3. Apply validation to all routes
app.listen(3000);                            // 4. Start accepting HTTP requests
```

### `app.module.ts` → Root of the tree
```typescript
@Module({
  imports: [AuthModule, PrismaModule],  // Load these two module trees
})
export class AppModule {}
```

### `prisma.module.ts` → Global DB access
```typescript
@Global()          // ← Makes PrismaService available in ALL modules without re-importing
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
```

### `prisma.service.ts` → The actual DB connection
```typescript
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL }); // pg connection pool
    const adapter = new PrismaPg(pool);  // Prisma 7 driver adapter wraps the pool
    super({ adapter });                  // Pass to PrismaClient
  }
  async onModuleInit() {
    await this.$connect();              // Connect to DB when NestJS starts
  }
}
```
Once connected, `PrismaService` inherits all Prisma query methods:
`this.user.findUnique(...)`, `this.workspace.create(...)`, etc.

### `auth.module.ts` → Wires up all auth dependencies
```typescript
@Module({
  imports: [
    PassportModule,                    // Enables Passport strategies
    JwtModule.register({               // Registers JwtService as a provider
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],       // Register the route handler
  providers: [AuthService, JwtStrategy], // Register business logic + strategy
})
```

### `auth.dto.ts` → Defines valid request shapes
```typescript
export class SignupDto {
  @IsEmail()     email: string;      // Must be a valid email format
  @MinLength(6)  password: string;   // Must be at least 6 chars
  @IsNotEmpty()  name: string;       // Cannot be empty
}
```
The global `ValidationPipe` in `main.ts` automatically validates every incoming request body against the DTO class used in the controller parameter.

### `jwt.strategy.ts` → Token validator
```typescript
// When a request arrives with Authorization: Bearer <token>:
async validate(payload: any) {       // payload = decoded JWT content
  const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new UnauthorizedException();
  return { id: payload.sub, email: payload.email }; // Attached to req.user
}
```

### `jwt-auth.guard.ts` → Route gate
```typescript
export class JwtAuthGuard extends AuthGuard('jwt') {}
// AuthGuard('jwt') tells Passport to use the 'jwt' strategy (JwtStrategy)
// Usage: @UseGuards(JwtAuthGuard) above any route you want to protect
```

---

## Request Lifecycle Traces

### POST /auth/signup

```
1. Request body: { email, password, name }
         │
         ▼
2. ValidationPipe checks body against SignupDto
   • Invalid? → 400 Bad Request immediately
   • Valid?   → continue
         │
         ▼
3. AuthController.signup(dto) called
         │
         ▼
4. AuthService.signup(dto):
   a. prisma.user.findUnique({ where: { email } })
      • Found?  → throw ConflictException (409)
      • Not found? → continue
   b. bcrypt.hash(password, 10) → hashedPassword
   c. prisma.user.create({ data: { email, hashedPassword, name } })
   d. jwtService.sign({ email: user.email, sub: user.id })
   e. return { access_token: "eyJ..." }
         │
         ▼
5. NestJS serializes return value → HTTP 201 response
```

### POST /auth/login

```
1. Request body: { email, password }
         │
         ▼
2. ValidationPipe checks body against LoginDto
         │
         ▼
3. AuthService.login(dto):
   a. prisma.user.findUnique({ where: { email } })
      • Not found? → throw UnauthorizedException (401)
   b. bcrypt.compare(password, user.password)
      • Doesn't match? → throw UnauthorizedException (401)
   c. jwtService.sign({ email: user.email, sub: user.id })
   d. return { access_token: "eyJ..." }
         │
         ▼
4. HTTP 200 response
```

### Protected Route (future routes with @UseGuards)

```
1. Request with: Authorization: Bearer eyJ...
         │
         ▼
2. JwtAuthGuard intercepts
         │
         ▼
3. Passport extracts token from header
         │
         ▼
4. JwtStrategy.validate(decodedPayload):
   a. prisma.user.findUnique({ where: { id: payload.sub } })
      • Not found? → 401
   b. return { id, email } → attached to req.user
         │
         ▼
5. Route handler runs, can access req.user
```

### POST /chat/:chatId/message (Full RAG Pipeline)

```
1. Request arrives with body: `query`
         │
         ▼
2. ChatController.sendMessage()
         │
         ▼
3. ChatService.savemsg() → Instantly saves User query to Postgres DB
         │
         ▼
4. AiService.searchSimilarChunks(query)
   a. Hits Gemini to turn query into Vector
   b. Hits Qdrant to find matching context paragraphs
         │
         ▼
5. AiService.generateAnswer(query, contextTexts, history)
   a. Constructs Prompt with conversation history + document context
   b. Hits Gemini `gemini-3.5-flash` for language generation
         │
         ▼
6. ChatService.savemsg() → Saves AI response to Postgres DB
         │
         ▼
7. Returns AI answer & source paragraphs to User
```

### POST /chat/:chatId/stream (Streaming RAG with SSE)

```
1. Request arrives with body: `query`
         │
         ▼
2. ChatController.streamMsg()
         │
         ▼
3. ChatService.savemsg() → Instantly saves User query to Postgres DB
         │
         ▼
4. Set HTTP Headers: `Content-Type: text/event-stream`
   (This tells the client to keep the connection open for chunks)
         │
         ▼
5. Fetch History (Prisma) & Context Chunks (Qdrant)
         │
         ▼
6. AiService.generateAnswerStream() 
   Returns an async iterable Stream Pipe connected to Gemini
         │
         ▼
7. Loop: `for await (const chunk of stream)`
   • Write `data: {text: chunk}` directly to `res`
   • Instantly hits the client in real-time
         │
         ▼
8. Stream finishes. 
   ChatService.savemsg() → Saves the full combined string to DB
   res.end() → Closes the connection.
```

---

## Prisma Setup (Prisma 7 Specifics)

Prisma 7 made breaking changes that affect how database URLs are configured:

| What changed | Old way (Prisma 5/6) | New way (Prisma 7) |
|---|---|---|
| URL in schema | `url = env("DATABASE_URL")` in `schema.prisma` | ❌ Not allowed anymore |
| URL for migrations | Not needed separately | In `prisma.config.ts` via `datasource.url` |
| URL for runtime client | Auto-read from env | Must pass via `adapter` in constructor |
| Client constructor | `new PrismaClient()` or `new PrismaClient({ datasourceUrl })` | `new PrismaClient({ adapter })` |

### Why Two Places for DATABASE_URL?

```
prisma.config.ts       → Used by Prisma CLI (npx prisma migrate dev)
                          Runs at build/dev time

prisma.service.ts      → Used by your running NestJS app
  new Pool({ connectionString: process.env.DATABASE_URL })
                          Runs at runtime
```

They both read from `DATABASE_URL` in `.env`, but serve completely different purposes.

---

## Environment Variables

File: `backend/.env`

```env
DATABASE_URL="postgresql://user:password@localhost:5432/researchflow"
JWT_SECRET="your-secret-key"    # Add this! Used for signing JWTs
PORT=3000                       # Optional, defaults to 3000
```

### How They're Loaded

- **`prisma.config.ts`** — uses `import 'dotenv/config'` at the top of that file
- **`src/prisma/prisma.service.ts`** — uses `import 'dotenv/config'` at the top (guarantees loading before the class constructor runs)
- **`src/main.ts`** — uses `import 'dotenv/config'` as the very first import

> ⚠️ Add `JWT_SECRET` to your `.env` if you haven't yet. The fallback `'supersecretkey'` in code is only for development — never for production.

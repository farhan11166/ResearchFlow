# ResearchFlow — Learning Guide

Concepts, patterns, and technologies explained from first principles.
This file is your reference for **understanding WHY things work the way they do**.

---

## Table of Contents
1. [NestJS Core Concepts](#nestjs-core-concepts)
2. [Dependency Injection](#dependency-injection)
3. [Authentication Concepts](#authentication-concepts)
4. [JWT Explained](#jwt-explained)
5. [Password Hashing with BCrypt](#password-hashing-with-bcrypt)
6. [Prisma & ORMs](#prisma--orms)
7. [Glossary](#glossary)

---

## NestJS Core Concepts

NestJS is a framework built on top of Express. It adds structure using TypeScript classes and decorators. The four main building blocks are:

### Module
A **Module** is an organizational box that groups related code. Every NestJS app has a root `AppModule`. Modules declare:

```typescript
@Module({
  imports: [],      // Other modules this module depends on
  controllers: [],  // HTTP route handlers
  providers: [],    // Injectable classes (services, strategies, guards)
  exports: [],      // Providers to share with other modules
})
```

Think of modules like departments in a company. The `AuthModule` is the "Auth Department" — it owns signup, login, and token verification.

### Controller
A **Controller** is responsible for handling incoming HTTP requests. It should NOT contain business logic — its only job is to receive a request and hand it off to a service.

```typescript
@Controller('auth')         // Base route: /auth
export class AuthController {
  @Post('signup')           // Handles POST /auth/signup
  signup(@Body() dto) {
    return this.authService.signup(dto);  // Hands off to service
  }
}
```

### Service
A **Service** contains the actual business logic — database queries, calculations, external API calls. Controllers are thin; services are fat.

```
Controller  →  "I received a signup request"
Service     →  "I'll check if the user exists, hash the password, save to DB, return a token"
```

### Provider / @Injectable
Any class decorated with `@Injectable()` can be managed by NestJS and injected into other classes. Services, strategies, and guards are all providers.

---

## Dependency Injection

This is one of the most important patterns in NestJS.

**Without DI (the bad way):**
```typescript
class AuthService {
  private prisma = new PrismaService();  // You create it yourself
  private jwt = new JwtService();        // Hard to swap, hard to test
}
```

**With DI (the NestJS way):**
```typescript
class AuthService {
  constructor(
    private readonly prisma: PrismaService,  // NestJS injects this
    private readonly jwtService: JwtService, // NestJS injects this
  ) {}
}
```

NestJS reads the TypeScript types in the constructor, finds the matching registered provider, and injects the right instance automatically. You never call `new Service()` yourself.

**Why it matters:**
- You can swap out a real service for a mock during testing
- NestJS handles the creation order automatically
- Providers are singletons by default — one instance shared everywhere

---

## Authentication Concepts

HTTP is **stateless** — the server has no memory of past requests. So how does a server know who you are on request #2?

### The Authentication Flow

```
1. User sends email + password to POST /auth/login
2. Server verifies credentials
3. Server issues a JWT token (a signed proof of identity)
4. Client stores the token (localStorage, cookie, etc.)
5. On every future request, client sends: Authorization: Bearer <token>
6. Server verifies the token signature — no database lookup needed
7. Server trusts the claims inside the token
```

### Passport.js

Passport is a middleware library for authentication strategies. A **Strategy** defines how to extract and validate credentials from a request.

- `JwtStrategy` — extracts the JWT from the `Authorization: Bearer` header and validates it
- NestJS's `@nestjs/passport` provides decorators to integrate Passport cleanly

### Guards

A **Guard** is a gatekeeper that runs before a route handler. It returns `true` (allow) or `false` (block).

```typescript
@UseGuards(JwtAuthGuard)  // Put this on any route you want to protect
@Get('profile')
getProfile(@Request() req) {
  return req.user;  // Populated by JwtStrategy.validate()
}
```

---

## JWT Explained

A JWT (JSON Web Token) looks like: `xxxxx.yyyyy.zzzzz`

It has three parts separated by dots:

| Part | Contains | Example |
|---|---|---|
| **Header** | Algorithm used | `{ "alg": "HS256" }` |
| **Payload** | Your data (claims) | `{ "sub": "userId", "email": "...", "exp": 1234567890 }` |
| **Signature** | Cryptographic proof | `HMACSHA256(header + payload, secret)` |

> ⚠️ The payload is only **base64 encoded, not encrypted**. Anyone can decode it. Never put sensitive data (passwords, secrets) in the payload. The signature just proves it came from your server.

**When you call `jwtService.sign(payload)`:**
- NestJS takes your payload, adds `iat` (issued at) and `exp` (expiry)
- Signs it with your `JWT_SECRET`
- Returns the full token string

**When `JwtStrategy.validate(payload)` runs:**
- Passport automatically verifies the signature using your secret
- If valid and not expired, it calls `validate()` with the decoded payload
- Whatever `validate()` returns is attached to `req.user`

---

## Password Hashing with BCrypt

Passwords must **never** be stored as plain text in the database. If your database is ever compromised, all your users are exposed.

BCrypt is a one-way hashing algorithm designed specifically for passwords:

```
"mypassword123"  +  random salt  →  bcrypt.hash()  →  "$2b$10$K3JaH..."
                                                               │
                                                  Can never be reversed
```

**On signup:**
```typescript
const hash = await bcrypt.hash(password, 10);
// "10" = salt rounds (how many iterations to run)
// Higher = more secure but slower. 10 is the industry standard.
```

**On login:**
```typescript
const isValid = await bcrypt.compare(plainPassword, storedHash);
// Rehashes the plain text the same way and compares
// Returns true/false — never decodes the stored hash
```

Even if two users have the same password, the stored hashes will be different because BCrypt generates a new random salt each time.

---

## Prisma & ORMs

An **ORM** (Object-Relational Mapper) lets you interact with a SQL database using your programming language instead of raw SQL.

Without Prisma:
```sql
SELECT * FROM "User" WHERE email = 'test@gmail.com' LIMIT 1;
```

With Prisma:
```typescript
await prisma.user.findUnique({ where: { email: 'test@gmail.com' } });
```

### Schema → Migration → Client

```
schema.prisma   ← You define your models in Prisma's syntax
      │
      │  npx prisma migrate dev --name <description>
      ▼
PostgreSQL DB   ← Prisma writes the SQL and updates the actual tables
      │
      │  npx prisma generate
      ▼
@prisma/client  ← TypeScript types for all your models are auto-generated
```

Every time you change your schema (add a field, new model), run both commands.

### Prisma 7 Driver Adapters

Prisma 7 introduced **driver adapters** — instead of Prisma managing the database connection internally, you provide one from a standard Node.js database library (`pg` for PostgreSQL). This gives better compatibility with connection pooling and serverless environments.

---

## File Uploads & Multipart Form Data

When a user uploads a file, they don't send standard JSON. They send `multipart/form-data`.

### How Multer Works

`multipart/form-data` splits the request body into multiple boundaries (parts). One part might be the file, another might be a text field.

In NestJS, we use **Multer** via the `@nestjs/platform-express` wrapper to intercept and parse these boundaries:

```typescript
@UseInterceptors(FileInterceptor('file')) // Intercepts the part named 'file'
```

- Multer streams the file directly to your disk (`destination: './uploads'`).
- Once finished, it creates a `file` object with metadata (name, size, mimetype).
- It injects that object into your controller via `@UploadedFile()`.

### The Postman Order Trap

Because Multer reads the incoming request as a **stream** from top to bottom, the **order of fields matters**.

If your `multipart/form-data` payload has:
1. `file`
2. `workspaceId`

Multer might process the file, trigger the controller, and ignore the remaining fields. Always put your **text fields above your file fields** in API clients like Postman.

---

## Glossary

| Term | Meaning |
|---|---|
| **DTO** | Data Transfer Object — a class defining the expected shape of a request body |
| **Guard** | Decides if a request is allowed to proceed (true = allow, false = block) |
| **Strategy** | Passport concept — defines how to extract and validate credentials |
| **Decorator** | A `@Something` annotation that adds metadata to a class, method, or parameter |
| **Pipe** | Transforms or validates data before it reaches a route handler |
| **Provider** | Any `@Injectable()` class managed and injected by NestJS |
| **Migration** | A versioned SQL script Prisma generates to update your database schema |
| **JWT** | JSON Web Token — a signed, stateless token proving identity |
| **BCrypt** | A slow, salted password hashing algorithm designed for security |
| **Salt rounds** | BCrypt iterations — higher = slower hash = harder to brute force |
| **ORM** | Object-Relational Mapper — query databases using TypeScript instead of SQL |
| **Connection Pool** | A cache of open database connections reused across requests for performance |
| **Singleton** | A design pattern where only one instance of a class exists — NestJS providers are singletons by default |

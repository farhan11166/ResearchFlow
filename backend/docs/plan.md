# ResearchFlow — Full Backend Roadmap

## Timeline: ~8 weeks (10–15 hrs/week)

### PHASE 1 — Backend Foundation (Week 1)
**Goal:** Create a professional backend foundation.
- [x] Project Setup (NestJS, Prisma, PostgreSQL, ESLint/Prettier, Env config)
- [x] Database Schema (User, Workspace, Document, Chat, Message)
- [x] Authentication (Signup, Login, Password hashing, JWT auth)
- [x] Prisma Service (Global Prisma module)

### PHASE 2 — Document Infrastructure (Week 2)
**Goal:** Handle document uploads properly.
- [x] File Upload (Multer, local file storage)
- [x] Document Entity (filename, size, type, upload status, owner)
- [x] PDF Parsing (Extract text using `pdf-parse`)
- [x] Workspace Support (Organize documents)

### PHASE 3 — AI Pipeline (Week 3)
**Goal:** Build embeddings pipeline.
- [x] Chunking (Split text into chunks)
- [x] Embeddings (OpenAI or Gemini)
- [x] Vector DB (Qdrant to store vectors, metadata, chunk references)
- [x] Background Workers (Redis, BullMQ to process embeddings async)

### PHASE 4 — Semantic Search + Chat (Week 4)
**Goal:** Make the app intelligent.
- [x] Semantic Search (Endpoint `/search` returning chunks and metadata)
- [x] RAG Pipeline (Retrieval, prompt construction, LLM generation)
- [x] Chat History (Store conversations and messages)
- [x] Streaming Responses (SSE or WebSockets)

### PHASE 5 — Backend Engineering Depth (Week 5)
**Goal:** Make it production-grade.
- [x] Redis Caching (Search results, chats, workspaces)
- [x] Rate Limiting (Protect endpoints via Throttler)
- [x] Logging (Pino/Winston)
- [x] Error Handling (Global exception filters)
- [x] Retry Mechanisms (BullMQ retries)

### PHASE 6 — Advanced Features (Week 6)
**Goal:** Add 2-3 advanced capabilities.
- [ ] Citations (Highlight source chunks)
- [x] Multi-document Search (Query across many PDFs)
- [x] Workspace Chat (Chat scoped to collections)
- [ ] OCR (Support scanned PDFs)

### PHASE 7 — Deployment + Polish (Week 7)
**Goal:** Make it resume-ready.
- [ ] Dockerize Everything (Backend, Postgres, Redis, Qdrant)
- [ ] CI/CD (GitHub Actions)
- [ ] Swagger Docs (Auto-generated API docs)
- [ ] Health Checks (Monitoring endpoints)
- [ ] Environment Config Cleanup

### PHASE 8 — Final Polish (Week 8)
**Goal:** Turn project into portfolio-quality work.
- [ ] README (Architecture, setup, screenshots, API docs)
- [ ] Architecture Diagram (API flow, queues, vector DB, Redis, workers)
- [ ] Demo Video (2–3 minutes showing flow)
- [ ] Testing (Auth tests, search tests)

-- CreateTable
CREATE TABLE "LiveQuiz" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tiebreakPrompt" TEXT,
    "tiebreakAnswer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRound" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "blurb" TEXT NOT NULL DEFAULT '',
    "rightPoints" INTEGER NOT NULL,
    "wrongPenalty" INTEGER NOT NULL DEFAULT 0,
    "placeDecay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LiveRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveQuestion" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "prompt" TEXT NOT NULL,
    "hint" TEXT,
    "answer" TEXT NOT NULL,
    "note" TEXT,
    "audioUrl" TEXT,

    CONSTRAINT "LiveQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'lobby',
    "roundIdx" INTEGER NOT NULL DEFAULT 0,
    "pos" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "questionOpenedAt" TIMESTAMP(3),
    "phaseUntil" TIMESTAMP(3),
    "hideFromRound" INTEGER NOT NULL DEFAULT 4,
    "lastTeamId" TEXT,
    "lastPoints" INTEGER,
    "tiedTeamIds" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTeam" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveBuzz" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "buzzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "LiveBuzz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveScoreEvent" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "questionId" TEXT,
    "roundIdx" INTEGER NOT NULL,
    "buzzId" INTEGER,
    "points" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "LiveScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveGuess" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveGuess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveRound_quizId_order_key" ON "LiveRound"("quizId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuestion_roundId_order_key" ON "LiveQuestion"("roundId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_code_key" ON "LiveSession"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LiveTeam_sessionId_name_key" ON "LiveTeam"("sessionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LiveTeam_sessionId_tokenHash_key" ON "LiveTeam"("sessionId", "tokenHash");

-- CreateIndex
CREATE INDEX "LiveBuzz_sessionId_questionId_idx" ON "LiveBuzz"("sessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveBuzz_sessionId_questionId_teamId_key" ON "LiveBuzz"("sessionId", "questionId", "teamId");

-- CreateIndex
CREATE INDEX "LiveScoreEvent_sessionId_idx" ON "LiveScoreEvent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveGuess_sessionId_teamId_key" ON "LiveGuess"("sessionId", "teamId");

-- AddForeignKey
ALTER TABLE "LiveRound" ADD CONSTRAINT "LiveRound_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveQuestion" ADD CONSTRAINT "LiveQuestion_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "LiveRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTeam" ADD CONSTRAINT "LiveTeam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveBuzz" ADD CONSTRAINT "LiveBuzz_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveScoreEvent" ADD CONSTRAINT "LiveScoreEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveGuess" ADD CONSTRAINT "LiveGuess_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;


import { mongoCollection } from "./mongo.js";

function notesCollection() {
  return mongoCollection("study_notes");
}

function stickyNotesCollection() {
  return mongoCollection("study_sticky_notes");
}

export async function listStickyNotes(userId: string) {
  return stickyNotesCollection().find({ user_id: userId }).sort({ pinned: -1, updated_at: -1 }).toArray();
}

export async function createStickyNote(userId: string, input: { text: string; color: string; format?: string; language?: string }) {
  const id = crypto.randomUUID();
  const now = new Date();
  const stickyNote = { _id: id, id, user_id: userId, text: input.text, color: input.color, format: input.format || "text", language: input.language || "plaintext", pinned: true, created_at: now, updated_at: now };
  await stickyNotesCollection().insertOne(stickyNote);
  return stickyNote;
}

export async function updateStickyNote(userId: string, stickyNoteId: string, input: { text: string; color: string; format?: string; language?: string; pinned: boolean }) {
  return stickyNotesCollection().findOneAndUpdate(
    { _id: stickyNoteId, user_id: userId },
    { $set: { ...input, updated_at: new Date() } },
    { returnDocument: "after" },
  );
}

export async function deleteStickyNote(userId: string, stickyNoteId: string) {
  const result = await stickyNotesCollection().deleteOne({ _id: stickyNoteId, user_id: userId });
  return result.deletedCount > 0;
}

export async function listNotes(userId: string, search = "") {
  const filter: Record<string, unknown> = { user_id: userId };
  const term = search.trim().slice(0, 100);
  if (term) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(escaped, "i");
    filter.$or = [
      { title: expression },
      { subject: expression },
      { chapter: expression },
      { content: expression },
    ];
  }
  return notesCollection().find(filter).sort({ updated_at: -1 }).toArray();
}

export async function getNote(userId: string, noteId: string) {
  return notesCollection().findOne({ _id: noteId, user_id: userId });
}

export async function createNote(userId: string, input: { title: string; subject: string; chapter: string; difficulty: string; content: string }) {
  const id = crypto.randomUUID();
  const now = new Date();
  const note = {
    _id: id,
    id,
    user_id: userId,
    title: input.title,
    subject: input.subject,
    chapter: input.chapter,
    difficulty: input.difficulty,
    content: input.content,
    bookmarked: false,
    revision_marked: false,
    progress_percent: 0,
    last_position: 0,
    last_viewed_at: null,
    created_at: now,
    updated_at: now,
  };
  await notesCollection().insertOne(note);
  return note;
}

export async function createNoteFromPdf(userId: string, documentId: string, input: { title: string; subject: string; chapter: string; difficulty: string; content: string }) {
  const document = await mongoCollection("study_note_documents").findOne({ _id: documentId, user_id: userId }, { projection: { filename: 1 } });
  if (!document) return null;
  const note = await createNote(userId, input);
  await notesCollection().updateOne({ _id: note.id, user_id: userId }, { $set: { source_document_id: documentId, source_filename: document.filename } });
  await mongoCollection("study_note_documents").updateOne({ _id: documentId, user_id: userId }, { $set: { status: "completed", generated_note_id: note.id, processing_error: null } });
  return { ...note, source_document_id: documentId, source_filename: document.filename };
}

export async function saveGeneratedNote(userId: string, documentId: string, input: { title: string; subject: string; content: string }) {
  const document = await mongoCollection("study_note_documents").findOne({ _id: documentId, user_id: userId });
  if (!document) return null;
  const id = crypto.randomUUID();
  const now = new Date();
  const note = {
    _id: id,
    id,
    user_id: userId,
    title: input.title,
    subject: input.subject,
    chapter: "",
    difficulty: "intermediate",
    content: input.content,
    source_document_id: documentId,
    source_filename: document.filename,
    bookmarked: false,
    revision_marked: false,
    progress_percent: 0,
    last_position: 0,
    last_viewed_at: null,
    created_at: now,
    updated_at: now,
  };
  await notesCollection().insertOne(note);
  return note;
}

export async function savePdfDocument(userId: string, filename: string, data: Buffer) {
  const id = crypto.randomUUID();
  const document = {
    _id: id,
    id,
    user_id: userId,
    filename,
    mime_type: "application/pdf",
    size_bytes: data.length,
    data,
    status: "uploaded",
    generated_note_id: null,
    processing_error: null,
    created_at: new Date(),
  };
  await mongoCollection("study_note_documents").insertOne(document);
  return document;
}

export async function listPdfDocuments(userId: string) {
  return mongoCollection("study_note_documents").find({ user_id: userId }, { projection: { data: 0 } }).sort({ created_at: -1 }).toArray();
}

export async function getPdfDocument(userId: string, documentId: string) {
  return mongoCollection("study_note_documents").findOne({ _id: documentId, user_id: userId });
}

export async function setPdfStatus(userId: string, documentId: string, status: "uploaded" | "processing" | "completed" | "failed", update: { noteId?: string; error?: string } = {}) {
  const values: Record<string, unknown> = { status, processing_error: update.error || null };
  if (update.noteId) values.generated_note_id = update.noteId;
  await mongoCollection("study_note_documents").updateOne({ _id: documentId, user_id: userId }, { $set: values });
}

export async function deletePdfDocument(userId: string, documentId: string) {
  const result = await mongoCollection("study_note_documents").deleteOne({ _id: documentId, user_id: userId });
  return result.deletedCount > 0;
}

export async function updateNote(userId: string, noteId: string, input: { title: string; subject: string; chapter: string; difficulty: string; content: string }) {
  const updated = await notesCollection().findOneAndUpdate(
    { _id: noteId, user_id: userId },
    { $set: { ...input, updated_at: new Date() } },
    { returnDocument: "after" },
  );
  return updated;
}

export async function setNoteBookmark(userId: string, noteId: string, bookmarked: boolean) {
  const result = await notesCollection().updateOne(
    { _id: noteId, user_id: userId },
    { $set: { bookmarked, updated_at: new Date() } },
  );
  return result.matchedCount > 0;
}

export async function setNoteRevision(userId: string, noteId: string, revisionMarked: boolean) {
  const result = await notesCollection().updateOne(
    { _id: noteId, user_id: userId },
    { $set: { revision_marked: revisionMarked, updated_at: new Date() } },
  );
  return result.matchedCount > 0;
}

export async function saveNoteProgress(userId: string, noteId: string, position: number, progressPercent: number) {
  const result = await notesCollection().updateOne(
    { _id: noteId, user_id: userId },
    { $set: { last_position: position, progress_percent: progressPercent, last_viewed_at: new Date() } },
  );
  return result.matchedCount > 0;
}

export async function deleteNote(userId: string, noteId: string) {
  const result = await notesCollection().deleteOne({ _id: noteId, user_id: userId });
  return result.deletedCount > 0;
}
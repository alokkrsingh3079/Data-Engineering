import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAllTimeSolved, summarizeDailyAttempts } from '../src/learning.ts';

test('daily progress groups attempts by local date and track and counts solved streaks', () => {
  const summary = summarizeDailyAttempts([
    { created_at: '2026-10-19T17:00:00.000Z', correct: true, track_id: 'sql-interview-lab', question_id: 'sql-1' },
    { created_at: '2026-10-19T18:00:00.000Z', correct: false, track_id: 'sql-interview-lab', question_id: 'sql-1' },
    { created_at: '2026-10-19T18:30:00.000Z', correct: true, track_id: 'sql-interview-lab', question_id: 'sql-1' },
    { created_at: '2026-10-19T19:00:00.000Z', correct: true, track_id: 'python-etl', question_id: 'python-1' },
    { created_at: '2026-10-18T19:00:00.000Z', correct: true, track_id: 'pyspark-foundations', question_id: 'spark-1' },
    { created_at: '2026-10-17T19:00:00.000Z', correct: false, track_id: 'python-etl', question_id: 'python-2' }
  ], 7, 'America/Los_Angeles', new Date('2026-10-19T20:00:00.000Z'));

  assert.equal(summary.streakDays, 2);
  assert.equal(summary.today.date, '2026-10-19');
  assert.equal(summary.today.attempts, 4);
  assert.equal(summary.today.solved, 2);
  assert.deepEqual(summary.today.tracks, [
    { trackId: 'python-etl', attempts: 1, solved: 1 },
    { trackId: 'sql-interview-lab', attempts: 3, solved: 1 }
  ]);
  assert.equal(summary.days.length, 7);
  assert.equal(summary.days[1].date, '2026-10-18');
  assert.equal(summary.days[1].tracks[0].trackId, 'pyspark-foundations');
});

test('daily progress streak expires after a day without a correct answer', () => {
  const summary = summarizeDailyAttempts([
    { created_at: '2026-10-17T19:00:00.000Z', correct: true, track_id: 'python-etl', question_id: 'python-1' }
  ], 7, 'UTC', new Date('2026-10-19T20:00:00.000Z'));

  assert.equal(summary.streakDays, 0);
  assert.equal(summary.today.solved, 0);
  assert.equal(summary.today.attempts, 0);
});

test('all-time solved totals count unique correct questions by track', () => {
  const totals = summarizeAllTimeSolved(['sql-1', 'sql-1', 'sql-2'], [
    { question_id: 'python-1', track_id: 'python-etl' },
    { question_id: 'python-1', track_id: 'python-etl' },
    { question_id: 'spark-1', track_id: 'pyspark-foundations' }
  ]);

  assert.deepEqual(totals, [
    { trackId: 'pyspark-foundations', solved: 1 },
    { trackId: 'python-etl', solved: 1 },
    { trackId: 'sql-interview-lab', solved: 2 }
  ]);
});

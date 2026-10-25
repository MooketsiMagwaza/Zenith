import { useState } from 'react';
import { storage } from '@/lib/platform';
import {
  applyRecords,
  exportJSON,
  importJSON,
  snapshotFromRecords,
  recordsWithSnapshot,
  isDataKey,
  type DataSnapshot,
} from '@/lib/zen/dataFormat';
import { exportCSV, importCSV, type DateOrder } from '@/lib/zen/csv';
import { exportMarkdown, importMarkdown } from '@/lib/zen/markdownData';
import { exportICS } from '@/lib/zen/ics';
import { importICS } from '@/lib/zen/icsImport';
import { mergeData } from '@/lib/zen/mergeData';
import { download } from '@/lib/zen/download';
export function DataView({
  canImport,
  onApplying,
}: {
  canImport: boolean;
  onApplying: (value: boolean) => void;
}) {
  const [format, setFormat] = useState<
      'json' | 'zenith' | 'toggl' | 'clockify' | 'markdown' | 'ics'
    >('json'),
    [order, setOrder] = useState<DateOrder>('ymd');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    records: Record<string, string>;
    data: DataSnapshot;
    baseline: string;
    name: string;
  } | null>(null);
  const read = () => Object.fromEntries(storage.entries().filter(([key]) => isDataKey(key)));
  const attempt = (fn: () => void) => {
    try {
      fn();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Data could not be read');
    }
  };
  const pick = async (file: File | undefined) => {
    setPreview(null);
    setError('');
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError('File is larger than 50 MB.');
      return;
    }
    setBusy(true);
    try {
      const text = await file.text(),
        before = read(),
        baseline = exportJSON(before, 0);
      let records: Record<string, string>;
      if (format === 'json') records = importJSON(text);
      else {
        const data = snapshotFromRecords(before),
          incoming =
            format === 'markdown'
              ? { journals: importMarkdown(text) }
              : format === 'ics'
                ? importICS(text)
                : { logs: importCSV(text, format, order) };
        records = recordsWithSnapshot(before, mergeData(data, incoming));
      }
      const data = snapshotFromRecords(records);
      if (
        data.active.startedAt !== null ||
        (records['zenith.pomodoro.v1'] && JSON.parse(records['zenith.pomodoro.v1']) !== null)
      )
        throw new Error(
          'Backup contains a running/waiting timer. End it on the source device before importing.',
        );
      setPreview({ records, data, baseline, name: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed validation');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="feature-page">
      <h1>Your data is yours</h1>
      <p>
        Everything lives on this device. Export a full backup or use open text formats to take your
        sessions and journals elsewhere. Import happens locally, with no account or upload.
      </p>
      <p>
        Full JSON keeps decks, cards, sessions, journals, reminders, optional-feature settings and
        Zen preferences. CSV contains time entries; Markdown contains journals; iCalendar contains
        sessions and enabled reminders. Format details are in docs/DATA_FORMAT.md in the source
        repository.
      </p>
      <div className="feature-grid">
        <button
          onClick={() =>
            attempt(() => download('zenith-backup-v1.json', exportJSON(read()), 'application/json'))
          }
        >
          Export full JSON
        </button>
        <button
          onClick={() =>
            attempt(() =>
              download(
                'zenith-time-v1.csv',
                exportCSV(snapshotFromRecords(read()).logs),
                'text/csv;charset=utf-8',
              ),
            )
          }
        >
          Export time entries CSV
        </button>
        <button
          onClick={() =>
            attempt(() =>
              download(
                'zenith-journals-v1.md',
                exportMarkdown(snapshotFromRecords(read()).journals),
                'text/markdown;charset=utf-8',
              ),
            )
          }
        >
          Export Markdown journals
        </button>
        <button
          onClick={() =>
            attempt(() => {
              const data = snapshotFromRecords(read());
              download(
                'zenith-calendar.ics',
                exportICS(data.logs, data.reminders),
                'text/calendar;charset=utf-8',
              );
            })
          }
        >
          Export iCalendar
        </button>
      </div>
      <h2>Import</h2>
      <p>
        End all timers first. JSON replaces this device's data; CSV, Markdown and iCalendar merge
        it. An automatic full backup downloads before applying an import. Journals with different
        content are appended to existing notes.
      </p>
      <fieldset disabled={!canImport || busy}>
        <label>
          Format
          <select
            value={format}
            onChange={(e) => {
              setFormat(e.target.value as typeof format);
              setPreview(null);
            }}
          >
            <option value="json">Full Zenith JSON</option>
            <option value="zenith">Zenith time entries CSV</option>
            <option value="toggl">Toggl detailed CSV</option>
            <option value="clockify">Clockify detailed CSV</option>
            <option value="markdown">Zenith Markdown journal bundle</option>
            <option value="ics">iCalendar (supported timed events)</option>
          </select>
        </label>
        {(format === 'toggl' || format === 'clockify') && (
          <label>
            Date order in the CSV
            <select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value as DateOrder);
                setPreview(null);
              }}
            >
              <option value="ymd">Year / month / day</option>
              <option value="dmy">Day / month / year</option>
              <option value="mdy">Month / day / year</option>
            </select>
          </label>
        )}
        <label>
          Choose a local file
          <input
            type="file"
            key={`${format}-${order}`}
            accept={
              format === 'json'
                ? '.json'
                : format === 'markdown'
                  ? '.md'
                  : format === 'ics'
                    ? '.ics'
                    : '.csv'
            }
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </label>
        {preview && (
          <article aria-live="polite">
            <h3>Review {preview.name}</h3>
            <p>
              Result: {preview.data.decks.length} decks,{' '}
              {preview.data.decks.reduce((s, d) => s + d.tasks.length, 0)} cards,{' '}
              {preview.data.logs.length} sessions, {preview.data.journals.length} journals,{' '}
              {preview.data.reminders.length} reminders.
            </p>
            <button
              onClick={async () => {
                setBusy(true);
                try {
                  const before = read();
                  if (exportJSON(before, 0) !== preview.baseline)
                    throw new Error('Data changed since the preview. Choose the file again.');
                  download('zenith-before-import-v1.json', exportJSON(before), 'application/json');
                  onApplying(true);
                  await applyRecords(storage, preview.records);
                  window.location.reload();
                } catch (e) {
                  onApplying(false);
                  setError(e instanceof Error ? e.message : 'Import could not be saved');
                  setBusy(false);
                }
              }}
            >
              {format === 'json' ? 'Replace data after backup' : 'Merge data after backup'}
            </button>
            <button onClick={() => setPreview(null)}>Cancel</button>
          </article>
        )}
      </fieldset>
      {!canImport && <p>End the active session and Pomodoro cycle before importing.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

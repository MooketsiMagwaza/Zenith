//! Durable log with local sequence numbers. A cursor belongs to the sender's log,
//! never to a global order. Acknowledgement must follow durable remote storage.
use crate::{identity::certificate_id, Change, DeviceId, Error, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{path::Path, time::Duration};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct StoredChange {
    pub sequence: u64,
    pub change: Change,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Peer {
    pub id: DeviceId,
    pub certificate: Vec<u8>,
    pub cursor: u64,
}

pub struct UpdateStore {
    connection: Connection,
}
impl UpdateStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        Self::initialize(Connection::open(path)?)
    }
    pub fn memory() -> Result<Self> {
        Self::initialize(Connection::open_in_memory()?)
    }
    fn initialize(connection: Connection) -> Result<Self> {
        connection.busy_timeout(Duration::from_secs(5))?;
        let version: i64 = connection.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if version > 1 {
            return Err(Error::Invalid("newer store schema"));
        }
        connection.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
            BEGIN IMMEDIATE;
            CREATE TABLE IF NOT EXISTS changes (
                sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                id BLOB NOT NULL UNIQUE CHECK(length(id)=32),
                version INTEGER NOT NULL, payload BLOB NOT NULL);
            CREATE TABLE IF NOT EXISTS peers (
                id BLOB PRIMARY KEY CHECK(length(id)=32), certificate BLOB NOT NULL,
                cursor INTEGER NOT NULL DEFAULT 0 CHECK(cursor>=0));
            PRAGMA user_version=1; COMMIT;",
        )?;
        Ok(Self { connection })
    }
    /// Returns the stored row and whether it was inserted. De-duplication never
    /// creates a cursor gap: do not use INSERT OR IGNORE with AUTOINCREMENT.
    pub fn append(&mut self, change: &Change) -> Result<(StoredChange, bool)> {
        change.validate()?;
        let transaction = self.connection.transaction()?;
        let existing: Option<u64> = transaction
            .query_row(
                "SELECT sequence FROM changes WHERE id=?1",
                [change.id.as_slice()],
                |r| unsigned(r, 0),
            )
            .optional()?;
        let inserted = existing.is_none();
        let sequence = if let Some(sequence) = existing {
            sequence
        } else {
            transaction.execute(
                "INSERT INTO changes(id,version,payload) VALUES (?1,?2,?3)",
                params![change.id.as_slice(), change.version, &change.payload],
            )?;
            transaction.last_insert_rowid() as u64
        };
        transaction.commit()?;
        Ok((
            StoredChange {
                sequence,
                change: change.clone(),
            },
            inserted,
        ))
    }
    pub fn after(&self, cursor: u64, limit: usize) -> Result<Vec<StoredChange>> {
        if cursor > i64::MAX as u64 || limit > 1024 {
            return Err(Error::Invalid("read cursor/limit"));
        }
        let mut query = self.connection.prepare("SELECT sequence,id,version,payload FROM changes WHERE sequence>?1 ORDER BY sequence LIMIT ?2")?;
        let rows = query.query_map(params![cursor as i64, limit as i64], |r| {
            let id: Vec<u8> = r.get(1)?;
            let id = id.try_into().map_err(|_| rusqlite::Error::InvalidQuery)?;
            Ok(StoredChange {
                sequence: unsigned(r, 0)?,
                change: Change {
                    id,
                    version: r.get(2)?,
                    payload: r.get(3)?,
                },
            })
        })?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }
    pub fn count(&self) -> Result<u64> {
        Ok(self
            .connection
            .query_row("SELECT COUNT(*) FROM changes", [], |r| unsigned(r, 0))?)
    }
    pub fn head(&self) -> Result<u64> {
        Ok(self
            .connection
            .query_row("SELECT COALESCE(MAX(sequence),0) FROM changes", [], |r| {
                unsigned(r, 0)
            })?)
    }
    /// Trusted-host operation; network input must only reach this after confirmed
    /// pairing. Re-pinning an existing device to different DER is refused.
    pub fn pin(&mut self, certificate: &[u8]) -> Result<DeviceId> {
        if certificate.len() > 8192 {
            return Err(Error::Invalid("certificate size"));
        }
        let id = certificate_id(certificate)?;
        if let Some(peer) = self.peer(id)? {
            if peer.certificate != certificate {
                return Err(Error::Invalid("certificate changed; revoke and re-pair"));
            }
            return Ok(id);
        }
        self.connection.execute(
            "INSERT INTO peers(id,certificate) VALUES (?1,?2)",
            params![id.0.as_slice(), certificate],
        )?;
        Ok(id)
    }
    pub fn peers(&self) -> Result<Vec<Peer>> {
        let mut query = self
            .connection
            .prepare("SELECT id,certificate,cursor FROM peers ORDER BY id")?;
        let rows = query.query_map([], |r| {
            let id: Vec<u8> = r.get(0)?;
            let id = id.try_into().map_err(|_| rusqlite::Error::InvalidQuery)?;
            Ok(Peer {
                id: DeviceId(id),
                certificate: r.get(1)?,
                cursor: unsigned(r, 2)?,
            })
        })?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }
    pub fn peer(&self, id: DeviceId) -> Result<Option<Peer>> {
        Ok(self.peers()?.into_iter().find(|p| p.id == id))
    }
    pub fn acknowledge(&mut self, id: DeviceId, cursor: u64) -> Result<()> {
        let peer = self.peer(id)?.ok_or(Error::Unpaired)?;
        if cursor < peer.cursor || cursor > self.head()? {
            return Err(Error::Invalid("acknowledgement cursor"));
        }
        self.connection.execute(
            "UPDATE peers SET cursor=?2 WHERE id=?1",
            params![id.0.as_slice(), cursor as i64],
        )?;
        Ok(())
    }
    pub fn revoke(&mut self, id: DeviceId) -> Result<()> {
        self.connection
            .execute("DELETE FROM peers WHERE id=?1", [id.0.as_slice()])?;
        Ok(())
    }
}

fn unsigned(row: &rusqlite::Row<'_>, column: usize) -> rusqlite::Result<u64> {
    let value: i64 = row.get(column)?;
    value.try_into().map_err(|_| rusqlite::Error::InvalidQuery)
}

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
        if version > 2 {
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
            CREATE TABLE IF NOT EXISTS discovery_keys (
                id BLOB PRIMARY KEY REFERENCES peers(id) ON DELETE CASCADE,
                secret BLOB NOT NULL CHECK(length(secret)=32));
            CREATE TABLE IF NOT EXISTS pairing_gate (
                singleton INTEGER PRIMARY KEY CHECK(singleton=1),
                attempts INTEGER NOT NULL, locked_until INTEGER NOT NULL);
            INSERT OR IGNORE INTO pairing_gate VALUES(1,0,0);
            PRAGMA user_version=2; COMMIT;",
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
            .execute("DELETE FROM discovery_keys WHERE id=?1", [id.0.as_slice()])?;
        self.connection
            .execute("DELETE FROM peers WHERE id=?1", [id.0.as_slice()])?;
        Ok(())
    }
    pub(crate) fn pin_paired(&mut self, certificate: &[u8], secret: &[u8; 32]) -> Result<DeviceId> {
        let id = certificate_id(certificate)?;
        if self.peer(id)?.is_some() {
            return Err(Error::Invalid("already paired; revoke before re-pairing"));
        }
        let transaction = self.connection.transaction()?;
        transaction.execute(
            "INSERT INTO peers(id,certificate) VALUES(?1,?2)",
            params![id.0.as_slice(), certificate],
        )?;
        transaction.execute(
            "INSERT INTO discovery_keys(id,secret) VALUES(?1,?2)",
            params![id.0.as_slice(), secret.as_slice()],
        )?;
        transaction.commit()?;
        Ok(id)
    }
    pub(crate) fn discovery_keys(&self) -> Result<Vec<(DeviceId, [u8; 32])>> {
        let mut query = self
            .connection
            .prepare("SELECT id,secret FROM discovery_keys ORDER BY id")?;
        let rows = query.query_map([], |r| {
            let id: Vec<u8> = r.get(0)?;
            let secret: Vec<u8> = r.get(1)?;
            Ok((
                DeviceId(id.try_into().map_err(|_| rusqlite::Error::InvalidQuery)?),
                secret
                    .try_into()
                    .map_err(|_| rusqlite::Error::InvalidQuery)?,
            ))
        })?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }
    pub(crate) fn check_pairing(&self, now: u64) -> Result<()> {
        let until: u64 = self.connection.query_row(
            "SELECT locked_until FROM pairing_gate WHERE singleton=1",
            [],
            |r| unsigned(r, 0),
        )?;
        if now < until {
            return Err(Error::PairingLocked);
        }
        Ok(())
    }
    // Charge before doing network/crypto work; interruption also consumes a guess.
    pub(crate) fn reserve_pairing(&mut self, now: u64) -> Result<()> {
        self.check_pairing(now)?;
        let until: i64 = now
            .checked_add(300)
            .and_then(|n| n.try_into().ok())
            .ok_or(Error::Invalid("pairing clock"))?;
        let transaction = self.connection.transaction()?;
        transaction.execute("UPDATE pairing_gate SET attempts=CASE WHEN locked_until>0 THEN 1 ELSE attempts+1 END, locked_until=0 WHERE singleton=1", [])?;
        transaction.execute(
            "UPDATE pairing_gate SET locked_until=?1 WHERE singleton=1 AND attempts>=5",
            [until],
        )?;
        transaction.commit()?;
        Ok(())
    }
    pub(crate) fn pairing_succeeded(&mut self) -> Result<()> {
        self.connection.execute(
            "UPDATE pairing_gate SET attempts=0,locked_until=0 WHERE singleton=1",
            [],
        )?;
        Ok(())
    }
}

fn unsigned(row: &rusqlite::Row<'_>, column: usize) -> rusqlite::Result<u64> {
    let value: i64 = row.get(column)?;
    value.try_into().map_err(|_| rusqlite::Error::InvalidQuery)
}

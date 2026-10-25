//! Fixed fields, explicit tags, big-endian integers and raw payload bytes. The
//! length is checked before allocation; there are no attacker-sized collections.
use super::{HANDSHAKE_TIMEOUT, MAX_FRAME_BYTES};
use crate::{Change, DeviceId, Error, Result};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

#[derive(Debug, PartialEq)]
pub(super) enum Message {
    Hello {
        version: u16,
        capabilities: u32,
        device: DeviceId,
    },
    Summary {
        head: u64,
        cursor: u64,
    },
    Change {
        sequence: u64,
        change: Change,
    },
    Ack {
        sequence: u64,
        id: [u8; 32],
    },
    CaughtUp {
        through: u64,
    },
    Ping,
}
impl Message {
    pub(super) fn encode(&self) -> Vec<u8> {
        let mut b = Vec::new();
        match self {
            Self::Hello {
                version,
                capabilities,
                device,
            } => {
                b.push(0);
                b.extend(version.to_be_bytes());
                b.extend(capabilities.to_be_bytes());
                b.extend(device.0);
            }
            Self::Summary { head, cursor } => {
                b.push(1);
                b.extend(head.to_be_bytes());
                b.extend(cursor.to_be_bytes());
            }
            Self::Change { sequence, change } => {
                b.push(2);
                b.extend(sequence.to_be_bytes());
                b.extend(change.version.to_be_bytes());
                b.extend(change.id);
                b.extend(&change.payload);
            }
            Self::Ack { sequence, id } => {
                b.push(3);
                b.extend(sequence.to_be_bytes());
                b.extend(id);
            }
            Self::CaughtUp { through } => {
                b.push(4);
                b.extend(through.to_be_bytes());
            }
            Self::Ping => b.push(5),
        }
        b
    }
    pub(super) fn decode(b: &[u8]) -> Result<Self> {
        let u64_at =
            |at| u64::from_be_bytes(b[at..at + 8].try_into().expect("checked fixed field"));
        match b.first() {
            Some(0) if b.len() == 39 => Ok(Self::Hello {
                version: u16::from_be_bytes(b[1..3].try_into().unwrap()),
                capabilities: u32::from_be_bytes(b[3..7].try_into().unwrap()),
                device: DeviceId(b[7..39].try_into().unwrap()),
            }),
            Some(1) if b.len() == 17 => Ok(Self::Summary {
                head: u64_at(1),
                cursor: u64_at(9),
            }),
            Some(2) if b.len() > 43 && b.len() <= MAX_FRAME_BYTES => Ok(Self::Change {
                sequence: u64_at(1),
                change: Change {
                    version: u16::from_be_bytes(b[9..11].try_into().unwrap()),
                    id: b[11..43].try_into().unwrap(),
                    payload: b[43..].to_vec(),
                },
            }),
            Some(3) if b.len() == 41 => Ok(Self::Ack {
                sequence: u64_at(1),
                id: b[9..41].try_into().unwrap(),
            }),
            Some(4) if b.len() == 9 => Ok(Self::CaughtUp { through: u64_at(1) }),
            Some(5) if b.len() == 1 => Ok(Self::Ping),
            Some(0..=5) => Err(Error::Invalid("message shape")),
            _ => Err(Error::Invalid("unknown message type")),
        }
    }
}
pub(super) async fn write<W: AsyncWrite + Unpin>(io: &mut W, message: &Message) -> Result<()> {
    let bytes = message.encode();
    if bytes.len() > MAX_FRAME_BYTES {
        return Err(Error::Invalid("frame size"));
    }
    tokio::time::timeout(HANDSHAKE_TIMEOUT, async {
        io.write_u32(bytes.len() as u32).await?;
        io.write_all(&bytes).await?;
        io.flush().await
    })
    .await
    .map_err(|_| Error::Timeout)??;
    Ok(())
}
pub(super) async fn read<R: AsyncRead + Unpin>(io: &mut R) -> Result<(Message, usize)> {
    let bytes = tokio::time::timeout(HANDSHAKE_TIMEOUT, async {
        let len = io.read_u32().await? as usize;
        if len == 0 || len > MAX_FRAME_BYTES {
            return Err(Error::Invalid("frame size"));
        }
        let mut bytes = vec![0; len];
        io.read_exact(&mut bytes).await?;
        Ok(bytes)
    })
    .await
    .map_err(|_| Error::Timeout)??;
    Ok((Message::decode(&bytes)?, bytes.len()))
}

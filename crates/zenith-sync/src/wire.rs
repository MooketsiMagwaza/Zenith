//! Strict bounded framing shared by pairing and transport. No allocation from
//! an unchecked length; whole-frame deadlines also cover slow partial writes.
use crate::{Error, Result};
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

pub(crate) async fn write<T: Serialize, W: AsyncWrite + Unpin>(
    io: &mut W,
    value: &T,
    cap: usize,
) -> Result<()> {
    let bytes = postcard::to_allocvec(value)?;
    if bytes.is_empty() || bytes.len() > cap {
        return Err(Error::Invalid("frame size"));
    }
    tokio::time::timeout(Duration::from_secs(10), async {
        io.write_u32(bytes.len() as u32).await?;
        io.write_all(&bytes).await?;
        io.flush().await
    })
    .await
    .map_err(|_| Error::Timeout)??;
    Ok(())
}
pub(crate) async fn read<T: DeserializeOwned, R: AsyncRead + Unpin>(
    io: &mut R,
    cap: usize,
) -> Result<T> {
    let bytes = tokio::time::timeout(Duration::from_secs(10), async {
        let len = io.read_u32().await? as usize;
        if len == 0 || len > cap {
            return Err(Error::Invalid("frame size"));
        }
        let mut bytes = vec![0; len];
        io.read_exact(&mut bytes).await?;
        Ok(bytes)
    })
    .await
    .map_err(|_| Error::Timeout)??;
    let (value, tail) = postcard::take_from_bytes(&bytes)?;
    if !tail.is_empty() {
        return Err(Error::Invalid("frame trailing bytes"));
    }
    Ok(value)
}

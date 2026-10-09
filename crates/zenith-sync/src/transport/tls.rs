//! Exact live certificate pins replace PKI/name/expiry checks. rustls still
//! verifies CertificateVerify: a copied public certificate is insufficient.
use crate::{identity::certificate_id, DeviceId, Engine, Error, Result};
use rustls::{
    client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier},
    crypto::{ring, verify_tls13_signature},
    pki_types::{CertificateDer, ServerName, UnixTime},
    server::danger::{ClientCertVerified, ClientCertVerifier},
    ClientConfig, DigitallySignedStruct, DistinguishedName, ServerConfig, SignatureScheme,
};
use std::sync::Arc;

struct Pins {
    engine: Arc<Engine>,
    expected: Option<DeviceId>,
}
impl std::fmt::Debug for Pins {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("LivePins")
    }
}
impl Pins {
    fn check(
        &self,
        cert: &CertificateDer<'_>,
        chain: &[CertificateDer<'_>],
    ) -> std::result::Result<(), rustls::Error> {
        let accepted = || -> Result<()> {
            if cert.len() > 8192 || !chain.is_empty() {
                return Err(Error::Authentication);
            }
            let id = certificate_id(cert.as_ref())?;
            if self.expected.is_some_and(|expected| expected != id) {
                return Err(Error::Authentication);
            }
            live_pin(&self.engine, id, cert.as_ref())
        };
        accepted().map_err(|_| {
            rustls::Error::InvalidCertificate(
                rustls::CertificateError::ApplicationVerificationFailure,
            )
        })
    }
}
pub(super) fn live_pin(engine: &Engine, peer: DeviceId, certificate: &[u8]) -> Result<()> {
    let store = engine.store.lock().map_err(|_| Error::Poisoned)?;
    let pin = store.peer(peer)?.ok_or(Error::Unpaired)?;
    if pin.certificate != certificate || peer == engine.identity().id() {
        return Err(Error::Authentication);
    }
    Ok(())
}
// Both verifier roles use the same maintained provider for handshake signatures.
macro_rules! signatures {
    () => {
        fn verify_tls12_signature(
            &self,
            _: &[u8],
            _: &CertificateDer<'_>,
            _: &DigitallySignedStruct,
        ) -> std::result::Result<HandshakeSignatureValid, rustls::Error> {
            Err(rustls::Error::General("TLS 1.2 disabled".into()))
        }
        fn verify_tls13_signature(
            &self,
            message: &[u8],
            cert: &CertificateDer<'_>,
            signature: &DigitallySignedStruct,
        ) -> std::result::Result<HandshakeSignatureValid, rustls::Error> {
            verify_tls13_signature(
                message,
                cert,
                signature,
                &ring::default_provider().signature_verification_algorithms,
            )
        }
        fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
            ring::default_provider()
                .signature_verification_algorithms
                .supported_schemes()
        }
    };
}
impl ServerCertVerifier for Pins {
    fn verify_server_cert(
        &self,
        cert: &CertificateDer<'_>,
        chain: &[CertificateDer<'_>],
        _: &ServerName<'_>,
        _: &[u8],
        _: UnixTime,
    ) -> std::result::Result<ServerCertVerified, rustls::Error> {
        self.check(cert, chain)?;
        Ok(ServerCertVerified::assertion())
    }
    signatures!();
}
impl ClientCertVerifier for Pins {
    fn root_hint_subjects(&self) -> &[DistinguishedName] {
        &[]
    }
    fn verify_client_cert(
        &self,
        cert: &CertificateDer<'_>,
        chain: &[CertificateDer<'_>],
        _: UnixTime,
    ) -> std::result::Result<ClientCertVerified, rustls::Error> {
        self.check(cert, chain)?;
        Ok(ClientCertVerified::assertion())
    }
    signatures!();
}
pub(super) fn client(engine: Arc<Engine>, expected: DeviceId) -> Result<Arc<ClientConfig>> {
    let mut config = ClientConfig::builder_with_provider(Arc::new(ring::default_provider()))
        .with_protocol_versions(&[&rustls::version::TLS13])?
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(Pins {
            engine: engine.clone(),
            expected: Some(expected),
        }))
        .with_client_auth_cert(
            vec![engine.identity().certificate()],
            engine.identity().private_key(),
        )?;
    config.resumption = rustls::client::Resumption::disabled();
    config.enable_sni = false;
    config.alpn_protocols = vec![b"zenith-sync/1".to_vec()];
    Ok(Arc::new(config))
}
pub(super) fn server(engine: Arc<Engine>) -> Result<Arc<ServerConfig>> {
    let mut config = ServerConfig::builder_with_provider(Arc::new(ring::default_provider()))
        .with_protocol_versions(&[&rustls::version::TLS13])?
        .with_client_cert_verifier(Arc::new(Pins {
            engine: engine.clone(),
            expected: None,
        }))
        .with_single_cert(
            vec![engine.identity().certificate()],
            engine.identity().private_key(),
        )?;
    config.send_tls13_tickets = 0;
    config.alpn_protocols = vec![b"zenith-sync/1".to_vec()];
    Ok(Arc::new(config))
}

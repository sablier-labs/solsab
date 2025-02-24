use base64::{engine::general_purpose::STANDARD as Engine, Engine as _};
use std::string::String;

/// Generate Stream NFT image SVG dynamically based on the NFT name
fn generate_stream_nft_svg(name: &str) -> String {
    format!(
        r#"<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="white"/>
            <text x="50%" y="50%" font-size="30" fill="blue" text-anchor="middle" dy=".3em">{}</text>
        </svg>"#,
        name
    )
}

/// Generate metadata with the dynamically generated SVG
pub fn generate_stream_nft_metadata_uri_base64(name: &str) -> String {
    let svg = generate_stream_nft_svg(name);
    let svg_base64 = Engine.encode(svg);
    let image_uri_base64 = format!("data:image/svg+xml;base64,{}", svg_base64);

    let nft_metadata = format!(
        r#"{{
            "name": "{}",
            "description": "On-chain NFT with dynamically generated SVG",
            "image": "{}",
            "external_url": "https://sablier.com"
        }}"#,
        name, image_uri_base64
    );

    Engine.encode(nft_metadata)
}

/// Unit tests for the functions
#[cfg(test)]
mod tests {
    use super::*;

    const EXPECTED_URI: &str = "ewogICAgICAgICAgICAibmFtZSI6ICJUZXN0TkZUIiwKICAgICAgICAgICAgImRlc2NyaXB0aW9uIjogIk9uLWNoYWluIE5GVCB3aXRoIGR5bmFtaWNhbGx5IGdlbmVyYXRlZCBTVkciLAogICAgICAgICAgICAiaW1hZ2UiOiAiZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCxQSE4yWnlCM2FXUjBhRDBpTXpBd0lpQm9aV2xuYUhROUlqTXdNQ0lnZUcxc2JuTTlJbWgwZEhBNkx5OTNkM2N1ZHpNdWIzSm5Mekl3TURBdmMzWm5JajRLSUNBZ0lDQWdJQ0FnSUNBZ1BISmxZM1FnZDJsa2RHZzlJakV3TUNVaUlHaGxhV2RvZEQwaU1UQXdKU0lnWm1sc2JEMGlkMmhwZEdVaUx6NEtJQ0FnSUNBZ0lDQWdJQ0FnUEhSbGVIUWdlRDBpTlRBbElpQjVQU0kxTUNVaUlHWnZiblF0YzJsNlpUMGlNekFpSUdacGJHdzlJbUpzZFdVaUlIUmxlSFF0WVc1amFHOXlQU0p0YVdSa2JHVWlJR1I1UFNJdU0yVnRJajVVWlhOMFRrWlVQQzkwWlhoMFBnb2dJQ0FnSUNBZ0lEd3ZjM1puUGc9PSIsCiAgICAgICAgICAgICJleHRlcm5hbF91cmwiOiAiaHR0cHM6Ly9zYWJsaWVyLmNvbSIKICAgICAgICB9";

    #[test]
    fn test_generate_stream_nft_metadata_uri() {
        let metadata_uri = generate_stream_nft_metadata_uri_base64("TestNFT");

        assert_eq!(metadata_uri, EXPECTED_URI);
    }
}

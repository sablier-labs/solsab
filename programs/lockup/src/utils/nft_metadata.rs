use base64::{engine::general_purpose::STANDARD as Engine, Engine as _};
use std::string::String;

/// Dynamically generate the SVG image for an NFT, based on its name
fn generate_nft_svg(name: &str) -> String {
    format!(
        r#"<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="white"/>
            <text x="50%" y="50%" font-size="30" fill="blue" text-anchor="middle" dy=".3em">{}</text>
        </svg>"#,
        name
    )
}

/// Dynamically generate the URI - in Base64 - for the NFT metadata
pub fn generate_nft_metadata_uri(name: &str, description: &str) -> String {
    let svg = generate_nft_svg(name);
    let svg_base64 = Engine.encode(svg);
    let image_uri_base64 = format!("data:image/svg+xml;base64,{}", svg_base64);

    let metadata_json = format!(
        r#"{{"name": "{name}","description": {description},"image": "{image_uri_base64}","external_url": "https://sablier.com"}}"#
    );

    let metadata_json_base64 = Engine.encode(metadata_json);
    format!(r#"data:application/json;base64,{}"#, metadata_json_base64)
}

/// Unit tests for the metadata generation functions
#[cfg(test)]
mod tests {
    use super::*;

    const EXPECTED_URI: &str = "data:application/json;base64,eyJuYW1lIjogIlRlc3QgTkZUIG5hbWUiLCJkZXNjcmlwdGlvbiI6IFRlc3QgTkZUIGRlc2NyaXB0aW9uLCJpbWFnZSI6ICJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBITjJaeUIzYVdSMGFEMGlNekF3SWlCb1pXbG5hSFE5SWpNd01DSWdlRzFzYm5NOUltaDBkSEE2THk5M2QzY3Vkek11YjNKbkx6SXdNREF2YzNabklqNEtJQ0FnSUNBZ0lDQWdJQ0FnUEhKbFkzUWdkMmxrZEdnOUlqRXdNQ1VpSUdobGFXZG9kRDBpTVRBd0pTSWdabWxzYkQwaWQyaHBkR1VpTHo0S0lDQWdJQ0FnSUNBZ0lDQWdQSFJsZUhRZ2VEMGlOVEFsSWlCNVBTSTFNQ1VpSUdadmJuUXRjMmw2WlQwaU16QWlJR1pwYkd3OUltSnNkV1VpSUhSbGVIUXRZVzVqYUc5eVBTSnRhV1JrYkdVaUlHUjVQU0l1TTJWdElqNVVaWE4wSUU1R1ZDQnVZVzFsUEM5MFpYaDBQZ29nSUNBZ0lDQWdJRHd2YzNablBnPT0iLCJleHRlcm5hbF91cmwiOiAiaHR0cHM6Ly9zYWJsaWVyLmNvbSJ9";

    #[test]
    fn test_generate_nft_metadata_uri() {
        let metadata_uri = generate_nft_metadata_uri("Test NFT name", "Test NFT description");

        println!("metadata_uri: {}", metadata_uri);
        assert_eq!(metadata_uri, EXPECTED_URI);
    }
}

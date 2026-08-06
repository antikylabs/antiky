use std::path::{Path, PathBuf};

const COMMANDS: &[&str] = &[
    "studio_context",
    "discover_development_connection",
    "terminal_open",
    "terminal_layout",
    "terminal_focus",
    "terminal_close",
    "terminal_status",
];

fn require_file(path: &Path) {
    if !path.is_file() {
        panic!(
            "missing pinned libghostty dependency at {}; run `npm run prepare:ghostty --workspace @antiky/studio-tauri`",
            path.display()
        );
    }
}

fn main() {
    let native = PathBuf::from(".native/ghostty");
    let include = native.join("include");
    let library = native.join("lib");
    require_file(&include.join("ghostty.h"));
    require_file(&library.join("libghostty-internal.a"));

    cc::Build::new()
        .file("src/native/terminal_bridge.m")
        .include(&include)
        .flag("-fobjc-arc")
        .flag("-fblocks")
        .flag("-Werror=unguarded-availability-new")
        .compile("antiky_terminal_bridge");

    println!("cargo:rustc-link-search=native={}", library.display());
    println!("cargo:rustc-link-lib=static=ghostty-internal");
    for framework in [
        "AppKit",
        "CoreGraphics",
        "CoreText",
        "Foundation",
        "IOSurface",
        "Metal",
        "QuartzCore",
    ] {
        println!("cargo:rustc-link-lib=framework={framework}");
    }
    println!("cargo:rustc-link-lib=c++");
    println!("cargo:rerun-if-changed=src/native/terminal_bridge.h");
    println!("cargo:rerun-if-changed=src/native/terminal_bridge.m");

    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS));
    tauri_build::try_build(attributes).expect("Tauri build configuration");
}

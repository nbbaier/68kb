# 68KB

A lightweight knowledge base application — forked from [68kb/68kb](https://github.com/68kb/68kb) with improved accessibility, modern UI, and SQLite support.

## What's Different

- **SQLite support** — no MySQL dependency; the database is a single file
- **Improved UI and accessibility** — cleaner interface with better usability
- **PHP 7.2+ compatibility** — updated constructors, removed deprecated functions
- **Summernote WYSIWYG editor** — replaces the old js-quicktags toolbar

## Quick Start

**Requirements:** PHP 7.2+ with the PDO SQLite extension enabled.

1. Upload the contents of the `upload/` directory to your web server
2. Point your web server's document root to the uploaded directory
3. Visit your site and follow the setup wizard at `/index.php/setup`

No MySQL needed — the database is a single SQLite file created automatically during setup.

## Credits

Originally forked from [68kb/68kb](https://github.com/68kb/68kb). The original project referenced a license at `http://68kb.com/user_guide/license.html` (now defunct).

### Bundled Third-Party Software

- [Summernote](https://github.com/summernote/summernote) — MIT License

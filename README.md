# Synology dss Backup Viewer

**Browser-based viewer for Synology DSM configuration backups (`.dss` files).**

Drop a `.dss` backup exported from DSM 7+ and browse settings organized by DSM Control Panel categories. Everything runs in your browser. Nothing is uploaded.

## Features

- **Category mapping** for config keys, tables, and parsed sections under matching DSM leaves
- **All Settings** searchable list of all config keys (sidebar footer)
- **Export** to JSON or CSV (ZIP bundle)

## Quick start

1. Clone this repository
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox)
3. Drop your `.dss` file onto the upload area

No web server or build step required.

## Exporting a DSM backup

In DSM: **Control Panel → Update & Restore → Configuration Backup → Back Up Configuration**

The exported file has a `.dss` extension. DSM 7.0 and later are supported.


## Privacy and sensitive data

Configuration backups can contain password hashes, user names, and network settings. This tool processes files locally only, but exported JSON/CSV files should be stored and shared carefully.

## Third-party licenses

| Component | License |
|-----------|---------|
| [xz-decompress](https://github.com/SteveSanderson/xzwasm) | MIT |
| [fflate](https://github.com/101arrowz/fflate) | MIT |

## Acknowledgements

File format understanding was informed by Synology Inspector (https://github.com/juergenbarth/synology-inspector). This project is an independent open-source implementation and does not include Synology Inspector source code.
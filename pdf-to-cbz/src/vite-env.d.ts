// SPDX-License-Identifier: Apache-2.0
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TARGET_LONG_EDGE_PX?: string;
  readonly VITE_MAX_SCALE?: string;
  readonly VITE_ENCODE_QUALITY?: string;
  readonly VITE_NATIVE_MAX_LONG_EDGE_PX?: string;
}

// File System Access save picker — present in Chromium but absent from the DOM lib.
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}
declare function showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;

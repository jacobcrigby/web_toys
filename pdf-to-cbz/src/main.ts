// SPDX-License-Identifier: Apache-2.0
import { getElements } from './ui/dom';
import { initApp } from './ui/app';
import { probeRuntimeCapabilities } from './core/runtime-capabilities';

initApp(getElements(), probeRuntimeCapabilities());

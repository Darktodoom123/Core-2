'use strict';

const fs = require('node:fs');
const path = require('node:path');

const buildRoot = path.resolve(process.argv[2] ?? 'public/build');
const requiredVariables = [
    'VITE_MAP_PROVIDER',
    'VITE_MAP_PLAN',
    'VITE_MAP_USE_CASE',
    'VITE_MAP_STYLE_URL',
    'VITE_MAP_ATTRIBUTION',
    'VITE_STADIA_MAPS_API_KEY',
];

function collectBundleFiles(directory) {
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const entryPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                return collectBundleFiles(entryPath);
            }

            return /\.(?:css|html|js|json|map)$/.test(entry.name)
                ? [entryPath]
                : [];
        });
}

if (!fs.existsSync(buildRoot)) {
    throw new Error(`Frontend build directory does not exist: ${buildRoot}`);
}

const bundleFiles = collectBundleFiles(buildRoot);
const bundleContents = bundleFiles.map((file) => fs.readFileSync(file, 'utf8'));

if (bundleContents.length === 0) {
    throw new Error(`Frontend build directory is empty: ${buildRoot}`);
}

for (const variable of requiredVariables) {
    const value = process.env[variable];

    if (!value) {
        throw new Error(`${variable} must be set for frontend bundle verification`);
    }

    if (!bundleContents.some((content) => content.includes(value))) {
        throw new Error(`${variable} was not found in the frontend bundle`);
    }

    console.log(`Verified ${variable} in the frontend bundle`);
}

const serverSecret = process.env.CORE2_SERVER_SECRET;

if (
    serverSecret &&
    bundleContents.some((content) => content.includes(serverSecret))
) {
    throw new Error(
        'A server-only credential was found in the frontend bundle',
    );
}

console.log(
    `Verified ${requiredVariables.length} public map values across ${bundleFiles.length} frontend asset(s)`,
);

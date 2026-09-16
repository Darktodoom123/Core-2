// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prevent Metro file-watcher from crashing when backend operations create/delete ephemeral files in storage
const ignoredPaths = [
    /.*[\\/]apps[\\/]operations[\\/]storage[\\/].*/,
    /.*[\\/]apps[\\/]tracking[\\/]storage[\\/].*/,
    /.*[\\/]\.system_generated[\\/].*/,
];

if (Array.isArray(config.resolver.blockList)) {
    config.resolver.blockList.push(...ignoredPaths);
} else if (config.resolver.blockList) {
    config.resolver.blockList = [config.resolver.blockList, ...ignoredPaths];
} else {
    config.resolver.blockList = ignoredPaths;
}

module.exports = config;
